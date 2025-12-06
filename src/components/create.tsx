import { Client } from "@atcute/client";
import { Did } from "@atcute/lexicons";
import { isNsid, isRecordKey } from "@atcute/lexicons/syntax";
import { getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { remove } from "@mary/exif-rm";
import { useNavigate, useParams } from "@solidjs/router";
import { createEffect, createSignal, For, lazy, onCleanup, Show, Suspense } from "solid-js";
import { hasUserScope } from "../auth/scope-utils";
import { agent, sessions } from "../auth/state";
import { Button } from "./button.jsx";
import { Modal } from "./modal.jsx";
import { addNotification, removeNotification } from "./notification.jsx";
import { TextInput } from "./text-input.jsx";
import Tooltip from "./tooltip.jsx";

const Editor = lazy(() => import("../components/editor.jsx").then((m) => ({ default: m.Editor })));

export const editorInstance = { view: null as any };
export const [placeholder, setPlaceholder] = createSignal<any>();

export const RecordEditor = (props: { create: boolean; record?: any; refetch?: any }) => {
  const navigate = useNavigate();
  const params = useParams();
  const [openDialog, setOpenDialog] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [openUpload, setOpenUpload] = createSignal(false);
  const [openInsertMenu, setOpenInsertMenu] = createSignal(false);
  const [validate, setValidate] = createSignal<boolean | undefined>(undefined);
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

  const defaultPlaceholder = () => {
    return {
      $type: "app.bsky.feed.post",
      text: "This post was sent from PDSls",
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://pdsls.dev",
          title: "PDSls",
          description: "Browse the public data on atproto",
        },
      },
      langs: ["en"],
      createdAt: new Date().toISOString(),
    };
  };

  const getValidateIcon = () => {
    return (
      validate() === true ? "lucide--circle-check"
      : validate() === false ? "lucide--circle-x"
      : "lucide--circle"
    );
  };

  const getValidateLabel = () => {
    return (
      validate() === true ? "True"
      : validate() === false ? "False"
      : "Unset"
    );
  };

  createEffect(() => {
    if (openDialog()) {
      setValidate(undefined);
      setCollectionError("");
      setRkeyError("");
    }
  });

  const createRecord = async (formData: FormData) => {
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
        validate: validate(),
      },
    });
    if (!res.ok) {
      setNotice(`${res.data.error}: ${res.data.message}`);
      return;
    }
    setOpenDialog(false);
    const id = addNotification({
      message: "Record created",
      type: "success",
    });
    setTimeout(() => removeNotification(id), 3000);
    navigate(`/${res.data.uri}`);
  };

  const editRecord = async (recreate?: boolean) => {
    const record = editorInstance.view.state.doc.toString();
    if (!record) return;
    const rpc = new Client({ handler: agent()! });
    try {
      const editedRecord = JSON.parse(record);
      if (recreate) {
        const res = await rpc.post("com.atproto.repo.applyWrites", {
          input: {
            repo: agent()!.sub,
            validate: validate(),
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
            validate: validate(),
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

  const MenuItem = (props: { icon: string; label: string; onClick: () => void }) => {
    return (
      <button
        type="button"
        class="flex items-center gap-2 rounded-md p-2 text-left text-xs hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        onClick={props.onClick}
      >
        <span class={`iconify ${props.icon}`}></span>
        <span>{props.label}</span>
      </button>
    );
  };

  const FileUpload = (props: { file: File }) => {
    const [uploading, setUploading] = createSignal(false);
    const [error, setError] = createSignal("");

    onCleanup(() => (blobInput.value = ""));

    const formatFileSize = (bytes: number) => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
    };

    const uploadBlob = async () => {
      let blob: Blob;

      const mimetype = (document.getElementById("mimetype") as HTMLInputElement)?.value;
      (document.getElementById("mimetype") as HTMLInputElement).value = "";
      if (mimetype) blob = new Blob([props.file], { type: mimetype });
      else blob = props.file;

      if ((document.getElementById("exif-rm") as HTMLInputElement).checked) {
        const exifRemoved = remove(new Uint8Array(await blob.arrayBuffer()));
        if (exifRemoved !== null) blob = new Blob([exifRemoved], { type: blob.type });
      }

      const rpc = new Client({ handler: agent()! });
      setUploading(true);
      const res = await rpc.post("com.atproto.repo.uploadBlob", {
        input: blob,
      });
      setUploading(false);
      if (!res.ok) {
        setError(res.data.error);
        return;
      }
      editorInstance.view.dispatch({
        changes: {
          from: editorInstance.view.state.selection.main.head,
          insert: JSON.stringify(res.data.blob, null, 2),
        },
      });
      setOpenUpload(false);
    };

    return (
      <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute top-70 left-[50%] w-[20rem] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 dark:border-neutral-700 starting:opacity-0">
        <h2 class="mb-2 font-semibold">Upload blob</h2>
        <div class="flex flex-col gap-2 text-sm">
          <div class="flex flex-col gap-1">
            <p class="flex gap-1">
              <span class="truncate">{props.file.name}</span>
              <span class="shrink-0 text-neutral-600 dark:text-neutral-400">
                ({formatFileSize(props.file.size)})
              </span>
            </p>
          </div>
          <div class="flex items-center gap-x-2">
            <label for="mimetype" class="shrink-0 select-none">
              MIME type
            </label>
            <TextInput id="mimetype" placeholder={props.file.type} />
          </div>
          <div class="flex items-center gap-1">
            <input id="exif-rm" type="checkbox" checked />
            <label for="exif-rm" class="select-none">
              Remove EXIF data
            </label>
          </div>
          <p class="text-xs text-neutral-600 dark:text-neutral-400">
            Metadata will be pasted after the cursor
          </p>
          <Show when={error()}>
            <span class="text-red-500 dark:text-red-400">Error: {error()}</span>
          </Show>
          <div class="flex justify-between gap-2">
            <Button onClick={() => setOpenUpload(false)}>Cancel</Button>
            <Show when={uploading()}>
              <div class="flex items-center gap-1">
                <span class="iconify lucide--loader-circle animate-spin"></span>
                <span>Uploading</span>
              </div>
            </Show>
            <Show when={!uploading()}>
              <Button
                onClick={uploadBlob}
                class="dark:shadow-dark-700 flex items-center gap-1 rounded-lg bg-blue-500 px-2 py-1.5 text-xs text-white shadow-xs select-none hover:bg-blue-600 active:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 dark:active:bg-blue-400"
              >
                Upload
              </Button>
            </Show>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal
        open={openDialog()}
        onClose={() => setOpenDialog(false)}
        closeOnClick={false}
        nonBlocking={isMinimized()}
      >
        <div
          style="transform: translateX(-50%) translateZ(0);"
          classList={{
            "dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto absolute top-18 left-1/2 flex flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-all duration-200 dark:border-neutral-700 starting:opacity-0": true,
            "w-[calc(100%-1rem)] max-w-3xl h-[65vh]": !isMaximized(),
            "w-[calc(100%-1rem)] max-w-7xl h-[85vh]": isMaximized(),
            hidden: isMinimized(),
          }}
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
                  class="dark:bg-dark-100 max-w-40 truncate rounded-lg border-[0.5px] border-neutral-300 bg-white px-1 py-1 select-none focus:outline-[1px] focus:outline-neutral-600 dark:border-neutral-600 dark:focus:outline-neutral-400"
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
                  <button
                    type="button"
                    class="dark:hover:bg-dark-200 dark:shadow-dark-700 dark:active:bg-dark-100 flex w-fit rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-1.5 text-base shadow-xs hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800"
                    onClick={() => setOpenInsertMenu(!openInsertMenu())}
                  >
                    <span class="iconify lucide--plus select-none"></span>
                  </button>
                  <Show when={openInsertMenu()}>
                    <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute bottom-full left-0 z-10 mb-1 flex w-40 flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-1.5 shadow-md dark:border-neutral-700">
                      <Show when={hasUserScope("blob")}>
                        <MenuItem
                          icon="lucide--upload"
                          label="Upload blob"
                          onClick={() => {
                            setOpenInsertMenu(false);
                            blobInput.click();
                          }}
                        />
                      </Show>
                      <MenuItem
                        icon="lucide--clock"
                        label="Insert timestamp"
                        onClick={insertTimestamp}
                      />
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
                >
                  <FileUpload file={blobInput.files![0]} />
                </Modal>
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded-sm p-1.5 text-xs hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    onClick={() =>
                      setValidate(
                        validate() === true ? false
                        : validate() === false ? undefined
                        : true,
                      )
                    }
                  >
                    <Tooltip text={getValidateLabel()}>
                      <span class={`iconify ${getValidateIcon()}`}></span>
                    </Tooltip>
                    <span>Validate</span>
                  </button>
                  <Show when={!props.create && hasUserScope("create") && hasUserScope("delete")}>
                    <Button onClick={() => editRecord(true)}>Recreate</Button>
                  </Show>
                  <Button
                    onClick={() =>
                      props.create ? createRecord(new FormData(formRef)) : editRecord()
                    }
                  >
                    {props.create ? "Create" : "Edit"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
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
      <Tooltip text={`${props.create ? "Create" : "Edit"} record`}>
        <button
          class={`flex items-center p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 ${props.create ? "rounded-lg" : "rounded-sm"}`}
          onclick={() => {
            setNotice("");
            setOpenDialog(true);
            setIsMinimized(false);
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
