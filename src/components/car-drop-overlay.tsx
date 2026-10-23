import { useNavigate } from "@solidjs/router";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";

import { isCarFile } from "../views/car/file-handlers.js";
import { queueCarFile } from "../views/car/state.js";
import { addNotification } from "./ui/notification.jsx";

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

export const CarDropOverlay = () => {
  const navigate = useNavigate();
  const [dragging, setDragging] = createSignal(false);
  // dragenter/dragleave fire for every child element, so count them to know when the drag leaves the window
  let depth = 0;

  onMount(() => {
    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth++;
      setDragging(true);
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);

      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      if (!isCarFile(file)) {
        addNotification({
          message: "Only .car files can be opened",
          type: "error",
          duration: 3000,
        });
        return;
      }
      queueCarFile(file);
      navigate("/car");
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    onCleanup(() => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    });
  });

  return (
    <Show when={dragging()}>
      <Portal>
        <div class="pointer-events-none fixed inset-0 z-100 flex items-center justify-center bg-neutral-50/80 p-4 backdrop-blur-sm dark:bg-neutral-900/80">
          <div class="dark:bg-dark-300 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-blue-400 bg-white px-10 py-8 text-center shadow-lg">
            <span class="iconify lucide--file-up text-3xl text-blue-500 dark:text-blue-400" />
            <p class="text-sm font-medium">Drop to open CAR file</p>
          </div>
        </div>
      </Portal>
    </Show>
  );
};
