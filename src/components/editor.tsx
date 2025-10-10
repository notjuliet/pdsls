import { indentWithTab } from "@codemirror/commands";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { basicDark } from "@fsegurai/codemirror-theme-basic-dark";
import { basicLight } from "@fsegurai/codemirror-theme-basic-light";
import { basicSetup, EditorView } from "codemirror";
import { onCleanup, onMount } from "solid-js";

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
        keymap.of([indentWithTab]),
        linter(jsonParseLinter()),
        themeColor.of(document.documentElement.classList.contains("dark") ? basicDark : basicLight),
      ],
    });
  });

  onCleanup(() =>
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", themeEvent),
  );

  return (
    <div
      ref={editorDiv}
      class="dark:shadow-dark-700 border-[0.5px] border-neutral-300 shadow-xs dark:border-neutral-700"
    ></div>
  );
};

export { Editor };
