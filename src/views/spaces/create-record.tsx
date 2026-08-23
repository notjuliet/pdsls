import { isNsid, isRecordKey } from "@atcute/lexicons/syntax";
import { useNavigate } from "@solidjs/router";
import type { EditorView } from "codemirror";
import { createEffect, createSignal, lazy, onCleanup, Show, Suspense } from "solid-js";

import { hasUserScope, SPACE_MANAGE_RECORDS_SCOPE_ID } from "../../auth/scope-utils.js";
import { Button } from "../../components/button.jsx";
import { ConfirmSubmit } from "../../components/create/confirm-submit.jsx";
import { FileUpload } from "../../components/create/file-upload.jsx";
import { HandleInput } from "../../components/create/handle-input.jsx";
import { MenuItem } from "../../components/create/menu-item.jsx";
import type { JSONType } from "../../components/json.jsx";
import { Modal } from "../../components/modal.jsx";
import { addNotification, removeNotification } from "../../components/notification.jsx";
import { PermissionButton } from "../../components/permission-button.jsx";
import { TextInput } from "../../components/text-input.jsx";
import {
  createSpaceRecord,
  putSpaceRecord,
  type SpaceRecordWriteResult,
} from "../../lib/spaces.js";
import { makeSpaceRecordPath, useSpaceRecords, useSpacesAuth } from "./context.jsx";

const Editor = lazy(() =>
  import("../../components/editor.jsx").then((m) => ({ default: m.Editor })),
);

interface SpaceRecordEditorProps {
  authority: string;
  type: string;
  skey: string;
  space: string;
  collection?: string;
  rkey?: string;
  record?: JSONType;
  mode?: "create" | "edit";
  label?: string;
  onSaved?: (result: SpaceRecordWriteResult, record: JSONType) => void;
}

const initialRecord = (collection?: string, record?: JSONType) =>
  JSON.stringify(
    record ?? {
      $type: collection ?? "",
    },
    null,
    2,
  );

export const SpaceRecordEditor = (props: SpaceRecordEditorProps) => {
  const auth = useSpacesAuth();
  const navigate = useNavigate();
  const spaceRecords = useSpaceRecords();
  const [open, setOpen] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [isMinimized, setIsMinimized] = createSignal(false);
  const [openAdvanced, setOpenAdvanced] = createSignal(false);
  const [openUpload, setOpenUpload] = createSignal(false);
  const [openInsertMenu, setOpenInsertMenu] = createSignal(false);
  const [openHandleDialog, setOpenHandleDialog] = createSignal(false);
  const [validate, setValidate] = createSignal<boolean | undefined>();
  const [recreate, setRecreate] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [collection, setCollection] = createSignal(props.collection ?? "");
  const [rkey, setRkey] = createSignal("");
  let editorView: EditorView | undefined;
  let blobInput!: HTMLInputElement;
  let insertMenuRef!: HTMLDivElement;
  const editing = () => props.mode === "edit";

  createEffect(() => {
    if (!openInsertMenu()) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!insertMenuRef.contains(event.target as Node)) setOpenInsertMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
  });

  const openEditor = () => {
    setCollection(props.collection ?? "");
    setRkey(props.rkey ?? "");
    setNotice("");
    setIsMinimized(false);
    setOpenAdvanced(false);
    setOpenUpload(false);
    setOpenInsertMenu(false);
    setOpenHandleDialog(false);
    setValidate(undefined);
    setRecreate(false);
    setOpen(true);
  };

  const closeEditor = () => {
    if (!submitting()) {
      setOpenAdvanced(false);
      setOpenUpload(false);
      setOpenInsertMenu(false);
      setOpenHandleDialog(false);
      setIsMinimized(false);
      setOpen(false);
    }
  };

  const insertTimestamp = () => {
    if (!editorView) return;
    editorView.dispatch({
      changes: {
        from: editorView.state.selection.main.head,
        insert: `"${new Date().toISOString()}"`,
      },
    });
    setOpenInsertMenu(false);
  };

  const insertDidFromHandle = () => {
    setOpenInsertMenu(false);
    setOpenHandleDialog(true);
  };

  const submit = async () => {
    if (submitting()) return;

    let record: unknown;
    try {
      if (!editorView) throw new Error("Editor is still loading");
      record = JSON.parse(editorView.state.doc.toString());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Record must be valid JSON");
      return;
    }

    if (record === null || typeof record !== "object" || Array.isArray(record)) {
      setNotice("Record must be a JSON object");
      return;
    }

    const recordType = "$type" in record ? record.$type : undefined;
    if (typeof recordType !== "string" || !isNsid(recordType)) {
      setNotice("Record must contain a valid $type NSID");
      return;
    }

    const targetCollection = collection().trim() || recordType;
    if (!isNsid(targetCollection)) {
      setNotice("Collection must be a valid NSID");
      return;
    }

    const targetRkey = rkey().trim();
    if (editing() && !targetRkey) {
      setNotice("Record key is required when editing");
      return;
    }
    if (targetRkey && !isRecordKey(targetRkey)) {
      setNotice("Record key must be 1–512 characters using a-z, A-Z, 0-9, ., _, ~, :, or -");
      return;
    }

    setSubmitting(true);
    setNotice("");
    try {
      const recordValue = record as JSONType;
      const result = editing()
        ? await putSpaceRecord(
            auth(),
            props.space,
            auth().sub,
            targetCollection,
            targetRkey,
            recordValue,
            validate(),
          )
        : await createSpaceRecord(
            auth(),
            props.space,
            targetCollection,
            recordValue,
            targetRkey || undefined,
            validate(),
          );
      const uriPrefix = `${props.space}/${auth().sub}/${targetCollection}/`;
      if (!result.uri.startsWith(uriPrefix)) {
        throw new Error("The PDS returned an invalid record URI");
      }
      const createdRkey = result.uri.slice(uriPrefix.length);
      if (!isRecordKey(createdRkey)) {
        throw new Error("The PDS returned an invalid record URI");
      }
      if (editing() && createdRkey !== targetRkey) {
        throw new Error("The PDS returned an unexpected record URI");
      }

      setOpen(false);
      setIsMinimized(false);
      spaceRecords.invalidateRecords();
      props.onSaved?.(result, recordValue);

      const notification = addNotification({
        message: editing() ? "Record updated" : "Record created",
        type: "success",
      });
      setTimeout(() => removeNotification(notification), 3000);

      if (!editing()) {
        navigate(
          makeSpaceRecordPath(
            props.authority,
            props.type,
            props.skey,
            auth().sub,
            targetCollection,
            createdRkey,
          ),
        );
      }
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : editing()
            ? "Could not update the record"
            : "Could not create the record",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PermissionButton
        scope={SPACE_MANAGE_RECORDS_SCOPE_ID}
        tooltip={props.label ? undefined : editing() ? "Edit record" : "Create record"}
        class={
          props.label
            ? "flex items-center gap-1 rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs transition-colors hover:bg-neutral-200/50 active:bg-neutral-200 sm:px-2 sm:py-0.75 sm:text-sm dark:border-neutral-700 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
            : `flex items-center p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 ${editing() ? "rounded-sm" : "rounded-md"}`
        }
        disabledClass={
          props.label
            ? "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs opacity-40 sm:px-2 sm:py-1 sm:text-sm"
            : `flex items-center p-1.5 opacity-40 ${editing() ? "rounded-sm" : "rounded-md"}`
        }
        onClick={openEditor}
      >
        <span class={`iconify ${editing() ? "lucide--pencil" : "lucide--square-pen"}`} />
        <Show when={props.label}>{props.label}</Show>
      </PermissionButton>

      <Modal
        open={open()}
        onClose={closeEditor}
        closeOnClick={false}
        nonBlocking={isMinimized()}
        alignTop
        contentClass={`dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto flex flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700 ${isMaximized() ? "h-[85vh] w-[calc(100%-1rem)] max-w-7xl" : "h-[65vh] w-[calc(100%-1rem)] max-w-3xl"} ${isMinimized() ? "hidden" : ""}`}
      >
        <div class="mb-2 flex items-center justify-between">
          <h2 class="font-semibold">{editing() ? "Editing record" : "Creating record"}</h2>
          <div class="flex items-center gap-1">
            <button
              type="button"
              aria-label="Minimize"
              onclick={() => setIsMinimized(true)}
              class="flex items-center rounded-lg p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
            >
              <span class="iconify lucide--minus" />
            </button>
            <button
              type="button"
              aria-label={isMaximized() ? "Restore window" : "Maximize"}
              onclick={() => setIsMaximized(!isMaximized())}
              class="flex items-center rounded-lg p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
            >
              <span
                class={`iconify ${isMaximized() ? "lucide--minimize-2" : "lucide--maximize-2"}`}
              />
            </button>
            <button
              type="button"
              aria-label="Close"
              disabled={submitting()}
              onclick={closeEditor}
              class="flex items-center rounded-lg p-1.5 hover:bg-neutral-200 active:bg-neutral-300 disabled:opacity-40 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
            >
              <span class="iconify lucide--x" />
            </button>
          </div>
        </div>

        <form
          class="flex min-h-0 flex-1 flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Show when={!editing()}>
            <div class="flex flex-wrap items-center gap-1 text-sm">
              <TextInput
                name="collection"
                disabled={!!props.collection}
                value={collection()}
                placeholder="Collection (default: $type)"
                class="w-56 placeholder:text-xs sm:w-64"
                onInput={(event) => setCollection(event.currentTarget.value)}
              />
              <span>/</span>
              <TextInput
                name="rkey"
                value={rkey()}
                placeholder="Record key (default: TID)"
                class="w-52 placeholder:text-xs"
                onInput={(event) => setRkey(event.currentTarget.value)}
              />
            </div>
          </Show>

          <div class="min-h-0 flex-1">
            <Suspense
              fallback={
                <div class="flex h-full items-center justify-center">
                  <span class="iconify lucide--loader-circle animate-spin text-xl" />
                </div>
              }
            >
              <Editor
                content={initialRecord(props.collection, props.record)}
                onReady={(view) => (editorView = view)}
              />
            </Suspense>
          </div>

          <Show when={notice()}>
            <div class="text-sm text-red-500 dark:text-red-400">{notice()}</div>
          </Show>

          <div class="flex justify-between gap-2">
            <div class="relative" ref={insertMenuRef}>
              <Button onClick={() => setOpenInsertMenu(!openInsertMenu())}>
                <span class="iconify lucide--plus" />
                <span>Add</span>
              </Button>
              <Show when={openInsertMenu()}>
                <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute bottom-full left-0 z-10 mb-1 flex w-40 flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-1.5 shadow-md dark:border-neutral-700">
                  <MenuItem
                    icon="lucide--id-card"
                    label="Insert DID"
                    onClick={insertDidFromHandle}
                  />
                  <MenuItem
                    icon="lucide--clock"
                    label="Insert timestamp"
                    onClick={insertTimestamp}
                  />
                  <button
                    type="button"
                    class={
                      hasUserScope("blob")
                        ? "flex items-center gap-2 rounded-md p-2 text-left text-xs hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                        : "flex items-center gap-2 rounded-md p-2 text-left text-xs opacity-40"
                    }
                    onClick={() => {
                      if (hasUserScope("blob")) {
                        setOpenInsertMenu(false);
                        blobInput.click();
                      }
                    }}
                  >
                    <span class="iconify lucide--upload shrink-0" />
                    <span>Upload blob{hasUserScope("blob") ? "" : " (permission needed)"}</span>
                  </button>
                </div>
              </Show>
              <input
                type="file"
                class="sr-only"
                ref={blobInput}
                onChange={(event) => {
                  if (event.currentTarget.files?.length) setOpenUpload(true);
                }}
              />
            </div>
            <Modal
              open={openUpload()}
              onClose={() => setOpenUpload(false)}
              closeOnClick={false}
              contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto w-[calc(100%-2rem)] max-w-xs rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
            >
              <Show when={blobInput.files?.[0]}>
                {(file) => (
                  <FileUpload
                    file={file()}
                    repo={auth().sub}
                    blobInput={blobInput}
                    onClose={() => setOpenUpload(false)}
                  />
                )}
              </Show>
            </Modal>
            <Modal
              open={openHandleDialog()}
              onClose={() => setOpenHandleDialog(false)}
              closeOnClick={false}
              contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto w-[calc(100%-2rem)] max-w-xs rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
            >
              <HandleInput onClose={() => setOpenHandleDialog(false)} />
            </Modal>
            <Modal
              open={openAdvanced()}
              onClose={() => setOpenAdvanced(false)}
              contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
            >
              <ConfirmSubmit
                isCreate
                validate={validate()}
                setValidate={setValidate}
                recreate={recreate()}
                setRecreate={setRecreate}
                onClose={() => setOpenAdvanced(false)}
              />
            </Modal>
            <div class="flex items-center justify-end gap-2">
              <Button onClick={() => setOpenAdvanced(true)}>Advanced</Button>
              <Button
                type="submit"
                disabled={submitting()}
                classList={{
                  "border-none! bg-blue-500! text-white! hover:bg-blue-600! active:bg-blue-700! disabled:opacity-60 dark:bg-blue-600! dark:hover:bg-blue-500! dark:active:bg-blue-400!": true,
                }}
              >
                <Show when={submitting()}>
                  <span class="iconify lucide--loader-circle animate-spin" />
                </Show>
                {submitting()
                  ? editing()
                    ? "Saving…"
                    : "Creating…"
                  : editing()
                    ? "Save"
                    : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <Show when={isMinimized() && open()}>
        <button
          class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 px-3 py-2 shadow-md hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700"
          onclick={() => setIsMinimized(false)}
        >
          <span class={`iconify ${editing() ? "lucide--pencil" : "lucide--square-pen"} text-lg`} />
          <span class="text-sm font-medium">
            {editing() ? "Editing record" : "Creating record"}
          </span>
        </button>
      </Show>
    </>
  );
};
