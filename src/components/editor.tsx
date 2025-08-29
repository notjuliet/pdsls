import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import * as monaco from "monaco-editor";
import { onMount } from "solid-js";

const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 1;

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
      fontFamily: "Roboto Mono",
      lineNumbers: isTouchDevice ? "off" : "on",
      fontSize: 12,
    });
  });

  return (
    <div ref={editorDiv} class="dark:shadow-dark-900/80 h-[20rem] shadow-sm sm:h-[24rem]"></div>
  );
};

export { Editor, editor };
