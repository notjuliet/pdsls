export const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const carFileAccept = isIOS ? undefined : ".car,application/vnd.ipld.car";

const isCarFile = (file: File): boolean => {
  return file.name.endsWith(".car") || file.type === "application/vnd.ipld.car";
};

export const createFileChangeHandler = (onFile: (file: File) => void) => (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    onFile(file);
  }
  input.value = "";
};

export const createDropHandler = (onFile: (file: File) => void) => (e: DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file && isCarFile(file)) {
    onFile(file);
  }
};

export const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
};
