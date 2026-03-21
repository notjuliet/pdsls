import { onCleanup } from "solid-js";

export const useFilterShortcut = (getRef: () => HTMLInputElement | undefined) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (
      e.key === "/" &&
      !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName) &&
      !document.querySelector("[data-modal]")
    ) {
      e.preventDefault();
      getRef()?.focus();
    }
  };
  document.addEventListener("keydown", handleKeyDown);
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
};
