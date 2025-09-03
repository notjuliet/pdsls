import { onCleanup, onMount } from "solid-js";
import { basicSetup, EditorView } from "codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { basicLight } from "@fsegurai/codemirror-theme-basic-light";
import { basicDark } from "@fsegurai/codemirror-theme-basic-dark";
import { Compartment } from "@codemirror/state";

export let editorView: EditorView;

const Editor = (props: { content: string }) => {
  let editorDiv!: HTMLDivElement;
  let themeColor = new Compartment();

  const themeEvent = () => {
    editorView.dispatch({
      effects: themeColor.reconfigure(
        window.matchMedia("(prefers-color-scheme: dark)").matches ? basicDark : basicLight,
      ),
    });
  };

  onMount(() => {
    const theme = EditorView.theme({
      ".cm-content": {
        fontFamily: "'Roboto Mono', monospace",
        fontSize: "12px",
      },
      ".cm-scroller": {
        overflow: "auto",
        maxHeight: "20rem",
      },
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeEvent);

    editorView = new EditorView({
      doc: props.content,
      parent: editorDiv,
      extensions: [
        basicSetup,
        theme,
        json(),
        linter(jsonParseLinter()),
        themeColor.of(document.documentElement.classList.contains("dark") ? basicDark : basicLight),
      ],
    });
  });

  onCleanup(() =>
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", themeEvent),
  );

  return <div ref={editorDiv} class="dark:shadow-dark-900/80 shadow-sm"></div>;
};

export { Editor };
