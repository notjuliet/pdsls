import { Client } from "@atcute/client";
import { Did } from "@atcute/lexicons";
import { isNsid, isRecordKey } from "@atcute/lexicons/syntax";
import { getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { useNavigate, useParams } from "@solidjs/router";
import {
  createEffect,
  createSignal,
  For,
  lazy,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { hasUserScope } from "../../auth/scope-utils";
import { agent, sessions } from "../../auth/state";
import { Button } from "../button.jsx";
import { Modal } from "../modal.jsx";
import { addNotification, removeNotification } from "../notification.jsx";
import { showPermissionPrompt } from "../permission-prompt";
import { TextInput } from "../text-input.jsx";
import Tooltip from "../tooltip.jsx";
import { ConfirmSubmit } from "./confirm-submit";
import { FileUpload } from "./file-upload";
import { HandleInput } from "./handle-input";
import { MenuItem } from "./menu-item";
import { editorInstance, placeholder, setPlaceholder } from "./state";

const Editor = lazy(() => import("../editor.jsx").then((m) => ({ default: m.Editor })));

export { editorInstance, placeholder, setPlaceholder };

export const RecordEditor = (props: {
  create: boolean;
  record?: any;
  refetch?: any;
  scope?: "create" | "update" | "delete" | "blob";
}) => {
  const navigate = useNavigate();
  const params = useParams();
  const [openDialog, setOpenDialog] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [openUpload, setOpenUpload] = createSignal(false);
  const [openInsertMenu, setOpenInsertMenu] = createSignal(false);
  const [openHandleDialog, setOpenHandleDialog] = createSignal(false);
  const [openConfirmDialog, setOpenConfirmDialog] = createSignal(false);

  const hasPermission = () => !props.scope || hasUserScope(props.scope);
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [isMinimized, setIsMinimized] = createSignal(false);
  const [collectionError, setCollectionError] = createSignal("");
  const [rkeyError, setRkeyError] = createSignal("");
  let blobInput!: HTMLInputElement;
  let formRef!: HTMLFormElement;
  let insertMenuRef!: HTMLDivElement;

  createEffect(() => {
    if (openInsertMenu()) {
      const handleClickOutside = (e: MouseEvent) => {
        if (insertMenuRef && !insertMenuRef.contains(e.target as Node)) {
          setOpenInsertMenu(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));
    }
  });

  onMount(() => {
    const keyEvent = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if ((ev.target as HTMLElement).closest("[data-modal]")) return;

      const key = props.create ? "n" : "e";
      if (ev.key === key) {
        ev.preventDefault();

        if (openDialog() && isMinimized()) {
          setIsMinimized(false);
        } else if (!openDialog() && !document.querySelector("[data-modal]")) {
          setOpenDialog(true);
        }
      }
    };

    window.addEventListener("keydown", keyEvent);
    onCleanup(() => window.removeEventListener("keydown", keyEvent));
  });

  const defaultPlaceholder = () => {
    return {
      $type: "app.bsky.feed.post",
      text: "This post was sent from PDSls",
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://pds.ls",
          title: "PDSls",
          description: "Browse the public data on atproto",
        },
      },
      langs: ["en"],
      createdAt: new Date().toISOString(),
    };
  };

  createEffect(() => {
    if (openDialog()) {
      setCollectionError("");
      setRkeyError("");
    }
  });

  const createRecord = async (validate: boolean | undefined) => {
    const formData = new FormData(formRef);
    const repo = formData.get("repo")?.toString();
    if (!repo) return;
    const rpc = new Client({ handler: new OAuthUserAgent(await getSession(repo as Did)) });
    const collection = formData.get("collection");
    const rkey = formData.get("rkey");
    let record: any;
    try {
      record = JSON.parse(editorInstance.view.state.doc.toString());
    } catch (e: any) {
      setNotice(e.message);
      return;
    }
    const res = await rpc.post("com.atproto.repo.createRecord", {
      input: {
        repo: repo as Did,
        collection: collection ? collection.toString() : record.$type,
        rkey: rkey?.toString().length ? rkey?.toString() : undefined,
        record: record,
        validate: validate,
      },
    });
    if (!res.ok) {
      setNotice(`${res.data.error}: ${res.data.message}`);
      return;
    }
    setOpenConfirmDialog(false);
    setOpenDialog(false);
    const id = addNotification({
      message: "Record created",
      type: "success",
    });
    setTimeout(() => removeNotification(id), 3000);
    navigate(`/${res.data.uri}`);
  };

  const editRecord = async (validate: boolean | undefined, recreate: boolean) => {
    const record = editorInstance.view.state.doc.toString();
    if (!record) return;
    const rpc = new Client({ handler: agent()! });
    try {
      const editedRecord = JSON.parse(record);
      if (recreate) {
        const res = await rpc.post("com.atproto.repo.applyWrites", {
          input: {
            repo: agent()!.sub,
            validate: validate,
            writes: [
              {
                collection: params.collection as `${string}.${string}.${string}`,
                rkey: params.rkey!,
                $type: "com.atproto.repo.applyWrites#delete",
              },
              {
                collection: params.collection as `${string}.${string}.${string}`,
                rkey: params.rkey,
                $type: "com.atproto.repo.applyWrites#create",
                value: editedRecord,
              },
            ],
          },
        });
        if (!res.ok) {
          setNotice(`${res.data.error}: ${res.data.message}`);
          return;
        }
      } else {
        const res = await rpc.post("com.atproto.repo.applyWrites", {
          input: {
            repo: agent()!.sub,
            validate: validate,
            writes: [
              {
                collection: params.collection as `${string}.${string}.${string}`,
                rkey: params.rkey!,
                $type: "com.atproto.repo.applyWrites#update",
                value: editedRecord,
              },
            ],
          },
        });
        if (!res.ok) {
          setNotice(`${res.data.error}: ${res.data.message}`);
          return;
        }
      }
      setOpenConfirmDialog(false);
      setOpenDialog(false);
      const id = addNotification({
        message: "Record edited",
        type: "success",
      });
      setTimeout(() => removeNotification(id), 3000);
      props.refetch();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const insertTimestamp = () => {
    const timestamp = new Date().toISOString();
    editorInstance.view.dispatch({
      changes: {
        from: editorInstance.view.state.selection.main.head,
        insert: `"${timestamp}"`,
      },
    });
    setOpenInsertMenu(false);
  };

  const insertDidFromHandle = () => {
    setOpenInsertMenu(false);
    setOpenHandleDialog(true);
  };

  return (
    <>
      <Modal
        open={openDialog()}
        onClose={() => setOpenDialog(false)}
        closeOnClick={false}
        nonBlocking={isMinimized()}
        alignTop
        contentClass={`dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto flex flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700 ${isMaximized() ? "w-[calc(100%-1rem)] max-w-7xl h-[85vh]" : "w-[calc(100%-1rem)] max-w-3xl h-[65vh]"} ${isMinimized() ? "hidden" : ""}`}
      >
        <div class="mb-2 flex w-full justify-between text-base">
          <div class="flex items-center gap-2">
            <span class="font-semibold select-none">
              {props.create ? "Creating" : "Editing"} record
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              onclick={() => setIsMinimized(true)}
              class="flex items-center rounded-lg p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
            >
              <span class="iconify lucide--minus"></span>
            </button>
            <button
              type="button"
              onclick={() => setIsMaximized(!isMaximized())}
              class="flex items-center rounded-lg p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
            >
              <span
                class={`iconify ${isMaximized() ? "lucide--minimize-2" : "lucide--maximize-2"}`}
              ></span>
            </button>
            <button
              id="close"
              onclick={() => setOpenDialog(false)}
              class="flex items-center rounded-lg p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
            >
              <span class="iconify lucide--x"></span>
            </button>
          </div>
        </div>
        <form ref={formRef} class="flex min-h-0 flex-1 flex-col gap-y-2">
          <Show when={props.create}>
            <div class="flex flex-wrap items-center gap-1 text-sm">
              <span>at://</span>
              <select
                class="dark:bg-dark-100 max-w-40 truncate rounded-md border border-neutral-200 bg-white px-1 py-1 select-none focus:outline-[1px] focus:outline-neutral-600 dark:border-neutral-600 dark:focus:outline-neutral-400"
                name="repo"
                id="repo"
              >
                <For each={Object.keys(sessions)}>
                  {(session) => (
                    <option value={session} selected={session === agent()?.sub}>
                      {sessions[session].handle ?? session}
                    </option>
                  )}
                </For>
              </select>
              <span>/</span>
              <TextInput
                id="collection"
                name="collection"
                placeholder="Collection (default: $type)"
                class={`w-40 placeholder:text-xs lg:w-52 ${collectionError() ? "border-red-500 focus:outline-red-500 dark:border-red-400 dark:focus:outline-red-400" : ""}`}
                onInput={(e) => {
                  const value = e.currentTarget.value;
                  if (!value || isNsid(value)) setCollectionError("");
                  else
                    setCollectionError(
                      "Invalid collection: use reverse domain format (e.g. app.bsky.feed.post)",
                    );
                }}
              />
              <span>/</span>
              <TextInput
                id="rkey"
                name="rkey"
                placeholder="Record key (default: TID)"
                class={`w-40 placeholder:text-xs lg:w-52 ${rkeyError() ? "border-red-500 focus:outline-red-500 dark:border-red-400 dark:focus:outline-red-400" : ""}`}
                onInput={(e) => {
                  const value = e.currentTarget.value;
                  if (!value || isRecordKey(value)) setRkeyError("");
                  else setRkeyError("Invalid record key: 1-512 chars, use a-z A-Z 0-9 . _ ~ : -");
                }}
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
                  <span class="iconify lucide--loader-circle animate-spin text-xl"></span>
                </div>
              }
            >
              <Editor
                content={JSON.stringify(
                  !props.create ? props.record
                  : params.rkey ? placeholder()
                  : defaultPlaceholder(),
                  null,
                  2,
                )}
              />
            </Suspense>
          </div>
          <div class="flex flex-col gap-2">
            <Show when={notice()}>
              <div class="text-sm text-red-500 dark:text-red-400">{notice()}</div>
            </Show>
            <div class="flex justify-between gap-2">
              <div class="relative" ref={insertMenuRef}>
                <Button onClick={() => setOpenInsertMenu(!openInsertMenu())}>
                  <span class="iconify lucide--plus"></span>
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
                        hasUserScope("blob") ?
                          "flex items-center gap-2 rounded-md p-2 text-left text-xs hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                        : "flex items-center gap-2 rounded-md p-2 text-left text-xs opacity-40"
                      }
                      onClick={() => {
                        if (hasUserScope("blob")) {
                          setOpenInsertMenu(false);
                          blobInput.click();
                        }
                      }}
                    >
                      <span class="iconify lucide--upload shrink-0"></span>
                      <span>Upload blob{hasUserScope("blob") ? "" : " (permission needed)"}</span>
                    </button>
                  </div>
                </Show>
                <input
                  type="file"
                  id="blob"
                  class="sr-only"
                  ref={blobInput}
                  onChange={(e) => {
                    if (e.target.files !== null) setOpenUpload(true);
                  }}
                />
              </div>
              <Modal
                open={openUpload()}
                onClose={() => setOpenUpload(false)}
                closeOnClick={false}
                contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto w-[20rem] rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
              >
                <FileUpload
                  file={blobInput.files![0]}
                  blobInput={blobInput}
                  onClose={() => setOpenUpload(false)}
                />
              </Modal>
              <Modal
                open={openHandleDialog()}
                onClose={() => setOpenHandleDialog(false)}
                closeOnClick={false}
                contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto w-[20rem] rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
              >
                <HandleInput onClose={() => setOpenHandleDialog(false)} />
              </Modal>
              <Modal
                open={openConfirmDialog()}
                onClose={() => setOpenConfirmDialog(false)}
                closeOnClick={false}
                contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto w-[24rem] rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
              >
                <ConfirmSubmit
                  isCreate={props.create}
                  onConfirm={(validate, recreate) => {
                    if (props.create) {
                      createRecord(validate);
                    } else {
                      editRecord(validate, recreate);
                    }
                  }}
                  onClose={() => setOpenConfirmDialog(false)}
                />
              </Modal>
              <div class="flex items-center justify-end gap-2">
                <Button onClick={() => setOpenConfirmDialog(true)}>
                  {props.create ? "Create..." : "Edit..."}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Modal>
      <Show when={isMinimized() && openDialog()}>
        <button
          class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 fixed right-4 bottom-4 z-30 flex items-center gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 px-3 py-2 shadow-md hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700"
          onclick={() => setIsMinimized(false)}
        >
          <span class="iconify lucide--square-pen text-lg"></span>
          <span class="text-sm font-medium">{props.create ? "Creating" : "Editing"} record</span>
        </button>
      </Show>
      <Tooltip
        text={
          hasPermission() ?
            props.create ?
              "Create record (n)"
            : "Edit record (e)"
          : `${props.create ? "Create record" : "Edit record"} (permission required)`
        }
      >
        <button
          class={
            hasPermission() ?
              `flex items-center p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 ${props.create ? "rounded-md" : "rounded-sm"}`
            : `flex items-center p-1.5 opacity-40 ${props.create ? "rounded-md" : "rounded-sm"}`
          }
          onclick={() => {
            if (hasPermission()) {
              setNotice("");
              setOpenDialog(true);
              setIsMinimized(false);
            } else if (props.scope) {
              showPermissionPrompt(props.scope);
            }
          }}
        >
          <div
            class={props.create ? "iconify lucide--square-pen text-lg" : "iconify lucide--pencil"}
          />
        </button>
      </Tooltip>
    </>
  );
};
