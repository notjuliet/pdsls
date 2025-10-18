import { Client } from "@atcute/client";
import { Did } from "@atcute/lexicons";
import { getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { remove } from "@mary/exif-rm";
import { useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Editor, editorView } from "../components/editor.jsx";
import { agent } from "../components/login.jsx";
import { setNotif } from "../layout.jsx";
import { sessions } from "./account.jsx";
import { Button } from "./button.jsx";
import { Modal } from "./modal.jsx";
import { TextInput } from "./text-input.jsx";
import Tooltip from "./tooltip.jsx";

export const [placeholder, setPlaceholder] = createSignal<any>();

export const RecordEditor = (props: { create: boolean; record?: any; refetch?: any }) => {
  const navigate = useNavigate();
  const params = useParams();
  const [openDialog, setOpenDialog] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [openUpload, setOpenUpload] = createSignal(false);
  const [validate, setValidate] = createSignal<boolean | undefined>(undefined);
  let blobInput!: HTMLInputElement;
  let formRef!: HTMLFormElement;

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

  const createRecord = async (formData: FormData) => {
    const repo = formData.get("repo")?.toString();
    if (!repo) return;
    const rpc = new Client({ handler: new OAuthUserAgent(await getSession(repo as Did)) });
    const collection = formData.get("collection");
    const rkey = formData.get("rkey");
    let record: any;
    try {
      record = JSON.parse(editorView.state.doc.toString());
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
    setNotif({ show: true, icon: "lucide--file-check", text: "Record created" });
    navigate(`/${res.data.uri}`);
  };

  const editRecord = async (recreate?: boolean) => {
    const record = editorView.state.doc.toString();
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
                rkey: params.rkey,
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
        const res = await rpc.post("com.atproto.repo.putRecord", {
          input: {
            repo: agent()!.sub,
            collection: params.collection as `${string}.${string}.${string}`,
            rkey: params.rkey,
            record: editedRecord,
            validate: validate(),
          },
        });
        if (!res.ok) {
          setNotice(`${res.data.error}: ${res.data.message}`);
          return;
        }
      }
      setOpenDialog(false);
      setNotif({ show: true, icon: "lucide--file-check", text: "Record edited" });
      props.refetch();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const dragBox = (box: HTMLDivElement) => {
    let currentBox: HTMLDivElement | null = null;
    let isDragging = false;
    let offsetX: number;
    let offsetY: number;

    const handleMouseDown = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLElement)) return;

      const closestDraggable = e.target.closest("[data-draggable]") as HTMLElement;
      if (closestDraggable && closestDraggable !== box) return;

      if (
        ["INPUT", "SELECT", "BUTTON", "LABEL"].includes(e.target.tagName) ||
        e.target.closest("#editor, #close")
      )
        return;

      e.preventDefault();
      isDragging = true;
      box.classList.add("cursor-grabbing");
      currentBox = box;

      const rect = box.getBoundingClientRect();

      box.style.left = rect.left + "px";
      box.style.top = rect.top + "px";

      box.classList.remove("-translate-x-1/2");

      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && box === currentBox) {
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        const boxWidth = box.offsetWidth;
        const boxHeight = box.offsetHeight;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        newLeft = Math.max(0, Math.min(newLeft, viewportWidth - boxWidth));
        newTop = Math.max(0, Math.min(newTop, viewportHeight - boxHeight));

        box.style.left = newLeft + "px";
        box.style.top = newTop + "px";
      }
    };

    const handleMouseUp = () => {
      if (isDragging && box === currentBox) {
        isDragging = false;
        box.classList.remove("cursor-grabbing");
        currentBox = null;
      }
    };

    onMount(() => {
      box.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    });

    onCleanup(() => {
      box.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    });
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
      editorView.dispatch({
        changes: {
          from: editorView.state.selection.main.head,
          insert: JSON.stringify(res.data.blob, null, 2),
        },
      });
      setOpenUpload(false);
    };

    return (
      <div
        data-draggable
        class="dark:bg-dark-300 dark:shadow-dark-700 absolute top-70 left-[50%] w-[20rem] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 dark:border-neutral-700 starting:opacity-0"
        ref={dragBox}
      >
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
      <Modal open={openDialog()} onClose={() => setOpenDialog(false)} closeOnClick={false}>
        <div
          data-draggable
          class="dark:bg-dark-300 dark:shadow-dark-700 absolute top-16 left-[50%] w-screen -translate-x-1/2 cursor-grab rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 sm:w-xl lg:w-[48rem] dark:border-neutral-700 starting:opacity-0"
          ref={dragBox}
        >
          <div class="mb-2 flex w-full justify-between">
            <div class="font-semibold">
              <span class="select-none">{props.create ? "Creating" : "Editing"} record</span>
            </div>
            <button
              id="close"
              onclick={() => setOpenDialog(false)}
              class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
            >
              <span class="iconify lucide--x"></span>
            </button>
          </div>
          <form ref={formRef} class="flex flex-col gap-y-2">
            <Show when={props.create}>
              <div class="flex flex-wrap items-center gap-1 text-sm">
                <span>at://</span>
                <select
                  class="dark:bg-dark-100 dark:shadow-dark-700 max-w-[10rem] truncate rounded-lg border-[0.5px] border-neutral-300 bg-white px-1 py-1 shadow-xs select-none focus:outline-[1px] focus:outline-neutral-600 dark:border-neutral-600 dark:focus:outline-neutral-400"
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
                  placeholder="Optional (default: $type)"
                  class="w-[10rem] placeholder:text-xs lg:w-[13rem]"
                />
                <span>/</span>
                <TextInput
                  id="rkey"
                  name="rkey"
                  placeholder="Optional (default: TID)"
                  class="w-[10rem] placeholder:text-xs lg:w-[13rem]"
                />
              </div>
            </Show>
            <Editor
              content={JSON.stringify(
                !props.create ? props.record
                : params.rkey ? placeholder()
                : defaultPlaceholder(),
                null,
                2,
              )}
            />
            <div class="flex flex-col gap-2">
              <Show when={notice()}>
                <div class="text-sm text-red-500 dark:text-red-400">{notice()}</div>
              </Show>
              <div class="flex justify-between gap-2">
                <button
                  type="button"
                  class="dark:hover:bg-dark-200 dark:shadow-dark-700 dark:active:bg-dark-100 flex w-fit rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 text-xs shadow-xs hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <input
                    type="file"
                    id="blob"
                    class="sr-only"
                    ref={blobInput}
                    onChange={(e) => {
                      if (e.target.files !== null) setOpenUpload(true);
                    }}
                  />
                  <label class="flex items-center gap-1 px-2 py-1.5 select-none" for="blob">
                    <span class="iconify lucide--upload"></span>
                    Upload
                  </label>
                </button>
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
                    class="flex items-center gap-1 rounded-sm p-1 text-sm hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
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
                  <Show when={!props.create}>
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
      <Tooltip text={`${props.create ? "Create" : "Edit"} record`}>
        <button
          class={`flex items-center p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600 ${props.create ? "rounded-lg" : "rounded-sm"}`}
          onclick={() => {
            setNotice("");
            setOpenDialog(true);
          }}
        >
          <div
            class={props.create ? "iconify lucide--square-pen text-xl" : "iconify lucide--pencil"}
          />
        </button>
      </Tooltip>
    </>
  );
};
