import { Client } from "@atcute/client";
import { remove } from "@mary/exif-rm";
import { createSignal, onCleanup, Show } from "solid-js";
import { agent } from "../../auth/state";
import { formatFileSize } from "../../utils/format";
import { Button } from "../button.jsx";
import { TextInput } from "../text-input.jsx";
import { editorInstance } from "./state";

export const FileUpload = (props: {
  file: File;
  blobInput: HTMLInputElement;
  onClose: () => void;
}) => {
  const [uploading, setUploading] = createSignal(false);
  const [error, setError] = createSignal("");

  onCleanup(() => (props.blobInput.value = ""));

  const uploadBlob = async () => {
    let blob: Blob;

    const mimetype = (document.getElementById("mimetype") as HTMLInputElement)?.value;
    (document.getElementById("mimetype") as HTMLInputElement).value = "";
    if (mimetype) blob = new Blob([props.file], { type: mimetype });
    else blob = props.file;

    if ((document.getElementById("exif-rm") as HTMLInputElement).checked) {
      const exifRemoved = remove(new Uint8Array(await blob.arrayBuffer()));
      if (exifRemoved !== null) blob = new Blob([exifRemoved as BlobPart], { type: blob.type });
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
    props.onClose();
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
          <Button onClick={props.onClose}>Cancel</Button>
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
