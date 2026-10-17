export const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const carFileAccept = isIOS ? undefined : ".car,application/vnd.ipld.car";

export const isCarFile = (file: File): boolean => {
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
