import type { Did } from "@atcute/lexicons";
import type { EditorView } from "codemirror";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

import { Button } from "../button.jsx";
import { Modal } from "../modal.jsx";
import { FileUpload } from "./file-upload.jsx";
import { HandleInput } from "./handle-input.jsx";

const MenuItem = (props: { icon: string; label: string; onClick: () => void }) => (
  <button
    type="button"
    class="flex items-center gap-2 rounded-md p-2 text-left text-xs hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
    onClick={props.onClick}
  >
    <span class={`iconify ${props.icon}`} />
    <span>{props.label}</span>
  </button>
);

export const InsertMenu = (props: {
  editor: () => EditorView | undefined;
  repo: Did | undefined;
  canUpload: boolean;
  dialogClass: string;
}) => {
  const [openMenu, setOpenMenu] = createSignal(false);
  const [openUpload, setOpenUpload] = createSignal(false);
  const [openHandle, setOpenHandle] = createSignal(false);
  let menuRef!: HTMLDivElement;
  let blobInput!: HTMLInputElement;
  let disposed = false;

  onCleanup(() => (disposed = true));

  createEffect(() => {
    if (!openMenu()) return;
    const closeOutside = (event: MouseEvent) => {
      if (!menuRef.contains(event.target as Node)) setOpenMenu(false);
    };
    document.addEventListener("mousedown", closeOutside);
    onCleanup(() => document.removeEventListener("mousedown", closeOutside));
  });

  const insert = (text: string) => {
    // An upload or handle lookup can finish after this editor has been closed.
    if (disposed) return;
    const editor = props.editor();
    if (!editor) return;
    editor.dispatch({ changes: { from: editor.state.selection.main.head, insert: text } });
  };

  return (
    <>
      <div class="relative" ref={menuRef}>
        <Button onClick={() => setOpenMenu(!openMenu())}>
          <span class="iconify lucide--plus" />
          <span>Add</span>
        </Button>
        <Show when={openMenu()}>
          <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute bottom-full left-0 z-10 mb-1 flex w-40 flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-1.5 shadow-md dark:border-neutral-700">
            <MenuItem
              icon="lucide--id-card"
              label="Insert DID"
              onClick={() => {
                setOpenMenu(false);
                setOpenHandle(true);
              }}
            />
            <MenuItem
              icon="lucide--clock"
              label="Insert timestamp"
              onClick={() => {
                insert(JSON.stringify(new Date().toISOString()));
                setOpenMenu(false);
              }}
            />
            <button
              type="button"
              class={
                props.canUpload
                  ? "flex items-center gap-2 rounded-md p-2 text-left text-xs hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  : "flex items-center gap-2 rounded-md p-2 text-left text-xs opacity-40"
              }
              onClick={() => {
                if (props.canUpload) {
                  setOpenMenu(false);
                  blobInput.click();
                }
              }}
            >
              <span class="iconify lucide--upload shrink-0" />
              <span>Upload blob{props.canUpload ? "" : " (permission needed)"}</span>
            </button>
          </div>
        </Show>
        <input
          type="file"
          class="sr-only"
          ref={blobInput}
          onChange={() => {
            if (blobInput.files?.length) setOpenUpload(true);
          }}
        />
      </div>
      <Modal
        open={openUpload()}
        onClose={() => setOpenUpload(false)}
        closeOnClick={false}
        contentClass={props.dialogClass}
      >
        <Show when={blobInput.files?.[0]}>
          {(file) => (
            <FileUpload
              file={file()}
              repo={props.repo!}
              blobInput={blobInput}
              onInsert={insert}
              onClose={() => setOpenUpload(false)}
            />
          )}
        </Show>
      </Modal>
      <Modal
        open={openHandle()}
        onClose={() => setOpenHandle(false)}
        closeOnClick={false}
        contentClass={props.dialogClass}
      >
        <HandleInput onInsert={insert} onClose={() => setOpenHandle(false)} />
      </Modal>
    </>
  );
};
