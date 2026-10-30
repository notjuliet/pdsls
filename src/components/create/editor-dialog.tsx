import type { Did } from "@atcute/lexicons";
import { isNsid, isRecordKey } from "@atcute/lexicons/syntax";
import type { EditorView } from "codemirror";
import {
  createEffect,
  createSignal,
  type JSX,
  lazy,
  on,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";

import { Button } from "../ui/button.jsx";
import { IconButton } from "../ui/icon-button.jsx";
import { Modal } from "../ui/modal.jsx";
import { Spinner } from "../ui/states.jsx";
import { ConfirmSubmit } from "./confirm-submit";
import { InsertMenu } from "./insert-menu.jsx";

const Editor = lazy(() => import("../ui/editor.jsx").then((m) => ({ default: m.Editor })));

export interface RecordWrite {
  record: Record<string, unknown> & { $type: string };
  collection: string;
  rkey: string | undefined;
  validate: boolean | undefined;
  recreate: boolean;
}

const COLLECTION_ERROR = "Invalid collection: use reverse domain format (e.g. app.bsky.feed.post)";
const RKEY_ERROR = "Invalid record key: 1-512 chars, use a-z A-Z 0-9 . _ ~ : -";

// The parts of the record's address, which sit inside one field like a URI.
const segmentClass =
  "min-w-0 bg-transparent px-1 py-1.5 outline-none placeholder:text-neutral-400 disabled:text-neutral-500 dark:placeholder:text-neutral-500 dark:disabled:text-neutral-400";
const invalidSegmentClass = "text-red-500 dark:text-red-400";
export const slashClass = "shrink-0 text-neutral-400 select-none dark:text-neutral-500";

const typeOf = (content: string) => {
  try {
    const type = JSON.parse(content)?.$type;
    return typeof type === "string" && type ? type : undefined;
  } catch {
    return undefined;
  }
};

export const RecordEditorDialog = (props: {
  mode: "create" | "edit";
  open: boolean;
  onClose: () => void;
  /** Called when the shortcut key is pressed while the editor is closed. */
  onRequestOpen?: () => void;
  shortcut?: string;
  content: string;
  collection?: string;
  lockCollection?: boolean;
  rkey?: string;
  /** Shown before the collection input, such as a repo picker. */
  targetPrefix?: JSX.Element;
  uploadRepo: Did | undefined;
  canUpload: boolean;
  allowRecreate?: boolean;
  onSubmit: (write: RecordWrite) => Promise<void>;
}) => {
  const [submitting, setSubmitting] = createSignal(false);
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [isMinimized, setIsMinimized] = createSignal(false);
  const [openAdvanced, setOpenAdvanced] = createSignal(false);
  const [validate, setValidate] = createSignal<boolean | undefined>();
  const [recreate, setRecreate] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [collection, setCollection] = createSignal("");
  const [rkey, setRkey] = createSignal("");
  // Shown as the collection's placeholder, since that is where the record goes by default.
  const [docType, setDocType] = createSignal(typeOf(props.content));
  let editorView: EditorView | undefined;
  const editing = () => props.mode === "edit";

  const collectionError = () => {
    const value = collection().trim();
    return value && !isNsid(value) ? COLLECTION_ERROR : "";
  };
  const rkeyError = () => {
    const value = rkey().trim();
    return value && !isRecordKey(value) ? RKEY_ERROR : "";
  };

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        setCollection(props.collection ?? "");
        setRkey(props.rkey ?? "");
        setDocType(typeOf(props.content));
        setNotice("");
        setIsMinimized(false);
        setOpenAdvanced(false);
        setValidate(undefined);
        setRecreate(false);
      },
    ),
  );

  onMount(() => {
    if (!props.shortcut) return;

    const keyEvent = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if ((ev.target as HTMLElement).closest("[data-modal]")) return;
      if (ev.key !== props.shortcut) return;

      ev.preventDefault();
      if (props.open && isMinimized()) {
        setIsMinimized(false);
      } else if (!props.open && !document.querySelector("[data-modal]")) {
        props.onRequestOpen?.();
      }
    };

    window.addEventListener("keydown", keyEvent);
    onCleanup(() => window.removeEventListener("keydown", keyEvent));
  });

  const close = () => {
    if (submitting()) return;
    setOpenAdvanced(false);
    setIsMinimized(false);
    props.onClose();
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
      await props.onSubmit({
        record: record as RecordWrite["record"],
        collection: targetCollection,
        rkey: targetRkey || undefined,
        validate: validate(),
        recreate: editing() && recreate(),
      });
      setIsMinimized(false);
      props.onClose();
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
      <Modal
        open={props.open}
        onClose={close}
        closeOnClick={false}
        nonBlocking={isMinimized()}
        alignTop
        contentClass={`flex flex-col ${isMaximized() ? "h-[85vh] w-[calc(100%-1rem)] max-w-7xl" : "h-[65vh] w-[calc(100%-1rem)] max-w-3xl"} ${isMinimized() ? "hidden" : ""}`}
      >
        <div class="mb-2 flex items-center justify-between">
          <h2 class="font-semibold select-none">
            {editing() ? "Editing record" : "Creating record"}
          </h2>
          <div class="flex items-center gap-1">
            <IconButton
              icon="lucide--minus"
              label="Minimize"
              tooltip={false}
              onClick={() => setIsMinimized(true)}
            />
            <IconButton
              icon={isMaximized() ? "lucide--minimize-2" : "lucide--maximize-2"}
              label={isMaximized() ? "Restore window" : "Maximize"}
              tooltip={false}
              onClick={() => setIsMaximized(!isMaximized())}
            />
            <IconButton
              icon="lucide--x"
              label="Close"
              tooltip={false}
              disabled={submitting()}
              onClick={close}
            />
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
            <div
              class={`dark:bg-dark-500 flex min-w-0 items-center rounded-md border-[0.5px] bg-white px-1 text-sm transition-colors ${collectionError() || rkeyError() ? "border-red-500 dark:border-red-400" : "border-neutral-300 focus-within:border-neutral-400 dark:border-neutral-700 dark:focus-within:border-neutral-500"}`}
            >
              {props.targetPrefix}
              <input
                name="collection"
                aria-label="Collection"
                title="Collection, defaults to the record's $type"
                spellcheck={false}
                disabled={props.lockCollection}
                value={collection()}
                placeholder={docType() ?? "collection"}
                class={`${segmentClass} [field-sizing:content] ${collectionError() ? invalidSegmentClass : ""}`}
                onInput={(event) => setCollection(event.currentTarget.value)}
              />
              <span class={slashClass}>/</span>
              <input
                name="rkey"
                aria-label="Record key"
                title="Record key, defaults to a new TID"
                spellcheck={false}
                value={rkey()}
                placeholder="TID"
                class={`${segmentClass} min-w-16 flex-1 ${rkeyError() ? invalidSegmentClass : ""}`}
                onInput={(event) => setRkey(event.currentTarget.value)}
              />
            </div>
            <Show when={collectionError() || rkeyError()}>
              <div class="text-xs text-red-500 dark:text-red-400">
                <div>{collectionError()}</div>
                <div>{rkeyError()}</div>
              </div>
            </Show>
          </Show>

          <div class="min-h-0 flex-1">
            <Suspense
              fallback={
                <div class="flex h-full items-center justify-center">
                  <Spinner class="text-xl" />
                </div>
              }
            >
              <Editor
                content={props.content}
                onReady={(view) => (editorView = view)}
                onChange={(doc) => setDocType(typeOf(doc))}
              />
            </Suspense>
          </div>

          <Show when={notice()}>
            <div class="text-sm text-red-500 dark:text-red-400">{notice()}</div>
          </Show>

          <div class="flex justify-between gap-2">
            <InsertMenu
              editor={() => editorView}
              repo={props.uploadRepo}
              canUpload={props.canUpload}
              dialogClass="w-[calc(100%-2rem)] max-w-xs"
            />
            <Modal
              open={openAdvanced()}
              onClose={() => setOpenAdvanced(false)}
              contentClass="w-[calc(100%-2rem)] max-w-sm"
            >
              <ConfirmSubmit
                allowRecreate={editing() && !!props.allowRecreate}
                validate={validate()}
                setValidate={setValidate}
                recreate={recreate()}
                setRecreate={setRecreate}
                onClose={() => setOpenAdvanced(false)}
              />
            </Modal>
            <div class="flex items-center justify-end gap-2">
              <Button onClick={() => setOpenAdvanced(true)}>Advanced</Button>
              <Button type="submit" disabled={submitting()} variant="primary">
                <Show when={submitting()}>
                  <Spinner />
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

      <Show when={isMinimized() && props.open}>
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
