import type { Did } from "@atcute/lexicons";
import type { EditorView } from "codemirror";
import { createSignal, onCleanup, Show } from "solid-js";

import { Button } from "../ui/button.jsx";
import { Modal } from "../ui/modal.jsx";
import { FileUpload } from "./file-upload.jsx";

export const UploadBlobButton = (props: {
  editor: () => EditorView | undefined;
  repo: Did | undefined;
  canUpload: boolean;
}) => {
  const [openUpload, setOpenUpload] = createSignal(false);
  let blobInput!: HTMLInputElement;
  let disposed = false;

  onCleanup(() => (disposed = true));

  const insert = async (value: unknown) => {
    // Imported here to keep CodeMirror in the editor's lazy chunk.
    const { insertValue } = await import("../ui/editor.jsx");
    // An upload can finish after this editor has been closed.
    if (disposed) return;
    const editor = props.editor();
    if (editor) insertValue(editor, value);
  };

  const closeUpload = () => {
    setOpenUpload(false);
    props.editor()?.focus();
  };

  return (
    <>
      <span class="flex" title={props.canUpload ? undefined : "Uploading blobs needs permission"}>
        <Button disabled={!props.canUpload} onClick={() => blobInput.click()}>
          {/* A line of text's height, so the button stays full size with only the icon. */}
          <span class="flex h-4 items-center">
            <span class="iconify lucide--upload shrink-0" />
          </span>
          {/* Phones only have room for the icon. */}
          <span class="sr-only sm:not-sr-only">Upload blob</span>
        </Button>
      </span>
      <input
        type="file"
        class="sr-only"
        tabIndex={-1}
        ref={blobInput}
        onChange={() => {
          if (blobInput.files?.length) setOpenUpload(true);
        }}
      />
      <Modal
        open={openUpload()}
        onClose={closeUpload}
        closeOnClick={false}
        contentClass="w-[calc(100%-2rem)] max-w-xs"
      >
        <Show when={blobInput.files?.[0]}>
          {(file) => (
            <FileUpload
              file={file()}
              repo={props.repo!}
              blobInput={blobInput}
              onInsert={insert}
              onClose={closeUpload}
            />
          )}
        </Show>
      </Modal>
    </>
  );
};
