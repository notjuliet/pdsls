import { createSignal, onMount, Show, onCleanup, createEffect } from "solid-js";
import { Client } from "@atcute/client";
import { agent } from "../components/login.jsx";
import { editor, Editor } from "../components/editor.jsx";
import * as monaco from "monaco-editor";
import { theme } from "../components/settings.jsx";
import Tooltip from "./tooltip.jsx";
import { ActorIdentifier } from "@atcute/lexicons";
import { useParams } from "@solidjs/router";
import { remove } from "@mary/exif-rm";
import { TextInput } from "./text-input.jsx";

export const RecordEditor = (props: { create: boolean; record?: any }) => {
  const params = useParams();
  const [modal, setModal] = createSignal<HTMLDialogElement>();
  const [openDialog, setOpenDialog] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [uploading, setUploading] = createSignal(false);
  let model: monaco.editor.IModel;
  let formRef!: HTMLFormElement;

  const placeholder = (date: string) => {
    return {
      $type: "app.bsky.feed.post",
      text: "This post was sent from PDSls",
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://pdsls.dev",
          title: "PDSls",
          description: "Browse and manage atproto repositories",
        },
      },
      langs: ["en"],
      createdAt: date,
    };
  };

  const keyEvent = (event: KeyboardEvent) => {
    if (modal() && event.key == "Escape") setOpenDialog(false);
  };

  onMount(() => window.addEventListener("keydown", keyEvent));

  onCleanup(() => window.removeEventListener("keydown", keyEvent));

  const createRecord = async (formData: FormData) => {
    const rpc = new Client({ handler: agent });
    const collection = formData.get("collection");
    const rkey = formData.get("rkey");
    const validate = formData.get("validate")?.toString();
    let record: any;
    try {
      record = JSON.parse(model.getValue());
    } catch (e: any) {
      setNotice(e.message);
      return;
    }
    const res = await rpc.post("com.atproto.repo.createRecord", {
      input: {
        repo: agent.sub,
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
    window.location.href = `/${res.data.uri}`;
  };

  const editRecord = async (formData: FormData) => {
    const record = model.getValue();
    const validate =
      formData.get("validate")?.toString() === "true" ? true
      : formData.get("validate")?.toString() === "false" ? false
      : undefined;
    if (!record) return;
    const rpc = new Client({ handler: agent });
    try {
      const editedRecord = JSON.parse(record.toString());
      if (formData.get("recreate")) {
        const res = await rpc.post("com.atproto.repo.applyWrites", {
          input: {
            repo: params.repo as ActorIdentifier,
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
            repo: params.repo as ActorIdentifier,
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
      window.location.reload();
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

    const rpc = new Client({ handler: agent });
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
    editor.executeEdits("editor", [
      {
        range: editor.getSelection() as monaco.IRange,
        text: JSON.stringify(res.data.blob, null, 2),
      },
    ]);
    editor.trigger("editor", "editor.action.formatDocument", {});
  };

  createEffect(() => {
    if (openDialog()) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    setNotice("");
  });

  const createModel = () => {
    if (!model)
      model = monaco.editor.createModel(
        JSON.stringify(
          props.create ? placeholder(new Date().toISOString()) : props.record,
          null,
          2,
        ),
        "json",
      );
  };

  return (
    <>
      <Show when={openDialog()}>
        <dialog
          ref={setModal}
          class="starting:backdrop-brightness-100 backdrop-brightness-70 fixed left-0 top-0 z-20 flex h-screen w-screen items-center justify-center bg-transparent transition duration-300"
        >
          <div class="dark:bg-dark-400 w-21rem sm:w-xl top-10% absolute rounded-md border border-slate-900 bg-zinc-100 p-2 text-slate-900 sm:p-4 lg:w-[50rem] dark:border-slate-100 dark:text-slate-100">
            <h3 class="mb-2 font-bold">{props.create ? "Creating" : "Editing"} record</h3>
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
                      class="w-14rem"
                    />
                  </div>
                  <div class="flex items-center gap-x-2">
                    <label for="rkey" class="min-w-20 select-none">
                      Record key
                    </label>
                    <TextInput id="rkey" name="rkey" placeholder="Optional" class="w-14rem" />
                  </div>
                </Show>
                <div class="flex items-center gap-x-2">
                  <label for="validate" class="min-w-20 select-none">
                    Validate
                  </label>
                  <select
                    name="validate"
                    id="validate"
                    class="dark:bg-dark-100 bg-light-100 border-1.5 rounded-lg border-neutral-300 px-1 py-1 focus:border-blue-500 focus:outline-none dark:border-neutral-500"
                  >
                    <option value="unset">Unset</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </div>
                <div class="flex flex-row items-center gap-2">
                  <Show when={!uploading()}>
                    <Tooltip text="Upload file">
                      <input
                        type="file"
                        title=""
                        id="blob"
                        class="i-lucide-upload text-xl"
                        onChange={() => uploadBlob()}
                      />
                    </Tooltip>
                    <p>Blob metadata will be pasted after the cursor</p>
                  </Show>
                  <Show when={uploading()}>
                    <div class="i-eos-icons-loading text-xl" />
                  </Show>
                </div>
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div class="flex items-center gap-x-2">
                    <label for="mimetype" class="min-w-20 select-none">
                      MIME type
                    </label>
                    <TextInput id="mimetype" placeholder="Optional" class="w-14rem" />
                  </div>
                  <div class="flex items-center gap-1">
                    <input id="exif-rm" class="size-4" type="checkbox" checked />
                    <label for="exif-rm" class="select-none">
                      Remove EXIF data
                    </label>
                  </div>
                </div>
              </div>
              <Editor theme={theme().color} model={model!} />
              <div class="flex flex-col gap-2">
                <Show when={notice()}>
                  <div class="text-red-500 dark:text-red-400">{notice()}</div>
                </Show>
                <div class="flex items-center justify-between gap-2">
                  <button
                    onclick={() => setOpenDialog(false)}
                    class="dark:hover:bg-dark-300 rounded-lg border border-slate-400 bg-transparent px-2 py-1.5 text-xs font-bold hover:bg-zinc-50 focus:border-blue-500 focus:outline-none sm:text-sm"
                  >
                    Close
                  </button>
                  <div class="flex items-center gap-2">
                    <Show when={!props.create}>
                      <div class="flex items-center gap-1">
                        <input id="recreate" class="size-4" name="recreate" type="checkbox" />
                        <label for="recreate" class="select-none">
                          Recreate record
                        </label>
                      </div>
                    </Show>
                    <button
                      type="button"
                      onclick={() =>
                        props.create ?
                          createRecord(new FormData(formRef))
                        : editRecord(new FormData(formRef))
                      }
                      class="rounded-lg bg-blue-500 px-2 py-1.5 text-xs font-bold text-slate-100 hover:bg-blue-400 sm:text-sm dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </dialog>
      </Show>
      <Show when={props.create}>
        <button
          onclick={() => {
            createModel();
            setOpenDialog(true);
          }}
        >
          <Tooltip text="Create record" children={<div class="i-lucide-square-pen text-xl" />} />
        </button>
      </Show>
      <Show when={!props.create}>
        <button
          onclick={() => {
            createModel();
            setOpenDialog(true);
          }}
        >
          <Tooltip text="Edit">
            <div class="i-lucide-pencil text-xl" />
          </Tooltip>
        </button>
      </Show>
    </>
  );
};
