import { createSignal, Show } from "solid-js";
import { Client } from "@atcute/client";
import { agent } from "../components/login.jsx";
import { Editor, editorView } from "../components/editor.jsx";
import Tooltip from "./tooltip.jsx";
import { useNavigate, useParams } from "@solidjs/router";
import { remove } from "@mary/exif-rm";
import { TextInput } from "./text-input.jsx";
import { Modal } from "./modal.jsx";
import { Button } from "./button.jsx";
import { setNotif } from "../layout.jsx";

export const RecordEditor = (props: { create: boolean; record?: any; refetch?: any }) => {
  const navigate = useNavigate();
  const params = useParams();
  const [openDialog, setOpenDialog] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [uploading, setUploading] = createSignal(false);
  let formRef!: HTMLFormElement;

  const placeholder = () => {
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

  const createRecord = async (formData: FormData) => {
    const rpc = new Client({ handler: agent()! });
    const collection = formData.get("collection");
    const rkey = formData.get("rkey");
    const validate = formData.get("validate")?.toString();
    let record: any;
    try {
      record = JSON.parse(editorView.state.doc.toString());
    } catch (e: any) {
      setNotice(e.message);
      return;
    }
    const res = await rpc.post("com.atproto.repo.createRecord", {
      input: {
        repo: agent()!.sub,
        collection: collection ? collection.toString() : record.$type,
        rkey: rkey?.toString().length ? rkey?.toString() : undefined,
        record: record,
        validate:
          validate === "true" ? true
          : validate === "false" ? false
          : undefined,
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

  const editRecord = async (formData: FormData) => {
    const record = editorView.state.doc.toString();
    const validate =
      formData.get("validate")?.toString() === "true" ? true
      : formData.get("validate")?.toString() === "false" ? false
      : undefined;
    if (!record) return;
    const rpc = new Client({ handler: agent()! });
    try {
      const editedRecord = JSON.parse(record);
      if (formData.get("recreate")) {
        const res = await rpc.post("com.atproto.repo.applyWrites", {
          input: {
            repo: agent()!.sub,
            validate: validate,
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
            validate: validate,
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

  const uploadBlob = async () => {
    setNotice("");
    let blob: Blob;

    const file = (document.getElementById("blob") as HTMLInputElement)?.files?.[0];
    if (!file) return;

    const mimetype = (document.getElementById("mimetype") as HTMLInputElement)?.value;
    (document.getElementById("mimetype") as HTMLInputElement).value = "";
    if (mimetype) blob = new Blob([file], { type: mimetype });
    else blob = file;

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
    (document.getElementById("blob") as HTMLInputElement).value = "";
    if (!res.ok) {
      setNotice(res.data.error);
      return;
    }
    editorView.dispatch({
      changes: {
        from: editorView.state.selection.main.head,
        insert: JSON.stringify(res.data.blob, null, 2),
      },
    });
  };

  return (
    <>
      <Modal open={openDialog()} onClose={() => setOpenDialog(false)} closeOnClick={false}>
        <div class="dark:bg-dark-800/70 dark:shadow-dark-900/80 absolute top-12 left-[50%] w-[22rem] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-200/70 p-2 text-neutral-900 shadow-md backdrop-blur-xs transition-opacity duration-300 sm:w-xl sm:p-4 lg:w-[48rem] dark:border-neutral-700 dark:text-neutral-200 starting:opacity-0">
          <div class="mb-2 flex w-full justify-between">
            <div class="flex items-center gap-1 font-semibold">
              <span class="iconify lucide--square-pen"></span>
              <span>{props.create ? "Creating" : "Editing"} record</span>
            </div>
            <button onclick={() => setOpenDialog(false)} class="flex items-center">
              <span class="iconify lucide--x text-lg hover:text-neutral-500 dark:hover:text-neutral-400"></span>
            </button>
          </div>
          <form ref={formRef} class="flex flex-col gap-y-2">
            <div class="flex w-fit flex-col gap-y-1 text-xs sm:text-sm">
              <Show when={props.create}>
                <div class="flex items-center gap-x-2">
                  <label for="collection" class="min-w-20 select-none">
                    Collection
                  </label>
                  <TextInput
                    id="collection"
                    name="collection"
                    placeholder="Optional (default: record type)"
                    class="w-[14rem]"
                  />
                </div>
                <div class="flex items-center gap-x-2">
                  <label for="rkey" class="min-w-20 select-none">
                    Record key
                  </label>
                  <TextInput id="rkey" name="rkey" placeholder="Optional" class="w-[14rem]" />
                </div>
              </Show>
              <div class="flex items-center gap-x-2">
                <label for="validate" class="min-w-20 select-none">
                  Validate
                </label>
                <select
                  name="validate"
                  id="validate"
                  class="dark:bg-dark-100 focus:outline-1.5 dark:shadow-dark-900/80 rounded-lg bg-white px-1 py-1 shadow-sm focus:outline-neutral-900 dark:focus:outline-neutral-200"
                >
                  <option value="unset">Unset</option>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </div>
              <div class="flex items-center gap-2">
                <Show when={!uploading()}>
                  <div class="dark:hover:bg-dark-100 dark:bg-dark-300 dark:shadow-dark-900/80 dark:active:bg-dark-100 flex rounded-lg bg-white text-xs font-semibold shadow-sm hover:bg-neutral-50 active:bg-neutral-50">
                    <input type="file" id="blob" hidden onChange={() => uploadBlob()} />
                    <label class="flex items-center gap-1 px-2 py-1.5" for="blob">
                      <span class="iconify lucide--upload text-sm"></span>
                      Upload
                    </label>
                  </div>
                  <p class="text-xs">Metadata will be pasted after the cursor</p>
                </Show>
                <Show when={uploading()}>
                  <span class="iconify lucide--loader-circle animate-spin text-xl"></span>
                  <p>Uploading...</p>
                </Show>
              </div>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-center gap-x-2">
                  <label for="mimetype" class="min-w-20 select-none">
                    MIME type
                  </label>
                  <TextInput id="mimetype" placeholder="Optional" class="w-[14rem]" />
                </div>
                <div class="flex items-center gap-1">
                  <input id="exif-rm" class="size-4" type="checkbox" checked />
                  <label for="exif-rm" class="select-none">
                    Remove EXIF data
                  </label>
                </div>
              </div>
            </div>
            <Editor
              content={JSON.stringify(props.create ? placeholder() : props.record, null, 2)}
            />
            <div class="flex flex-col gap-2">
              <Show when={notice()}>
                <div class="text-red-500 dark:text-red-400">{notice()}</div>
              </Show>
              <div class="flex items-center justify-end gap-2">
                <Show when={!props.create}>
                  <div class="flex items-center gap-1">
                    <input id="recreate" class="size-4" name="recreate" type="checkbox" />
                    <label for="recreate" class="text-sm select-none">
                      Recreate record
                    </label>
                  </div>
                </Show>
                <Button
                  onClick={() =>
                    props.create ?
                      createRecord(new FormData(formRef))
                    : editRecord(new FormData(formRef))
                  }
                >
                  {props.create ? "Create" : "Edit"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Modal>
      <Tooltip text={`${props.create ? "Create" : "Edit"} record`}>
        <button
          class={`flex items-center p-1 hover:bg-neutral-200 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-700 ${props.create ? "rounded-lg" : "rounded-sm"}`}
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
