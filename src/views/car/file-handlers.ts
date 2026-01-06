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
