import { createSignal } from "solid-js";

export const editorInstance = { view: null as any };
export const [placeholder, setPlaceholder] = createSignal<any>();
