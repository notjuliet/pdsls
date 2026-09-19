import { createSignal } from "solid-js";

const [queuedCarFile, setQueuedCarFile] = createSignal<File>();

export { queuedCarFile };

export const queueCarFile = (file: File) => {
  setQueuedCarFile(file);
};

export const clearQueuedCarFile = (file: File) => {
  if (queuedCarFile() === file) setQueuedCarFile();
};
