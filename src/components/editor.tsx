import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import * as monaco from "monaco-editor";
import { onMount } from "solid-js";

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === "json") return new jsonWorker();
    return new editorWorker();
  },
};

let editor: monaco.editor.IStandaloneCodeEditor;

const Editor = (props: { theme: string; model: monaco.editor.IModel }) => {
  let editorDiv!: HTMLDivElement;

  onMount(() => {
    editor = monaco.editor.create(editorDiv, {
      minimap: { enabled: false },
      theme: props.theme === "dark" ? "vs-dark" : "vs",
      model: props.model,
      wordWrap: "on",
      automaticLayout: true,
    });
  });

  return <div ref={editorDiv} class="h-20rem sm:h-24rem dark:shadow-dark-900/80 shadow-sm"></div>;
};

export { Editor, editor };
