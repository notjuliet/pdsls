import { indentWithTab } from "@codemirror/commands";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter } from "@codemirror/lint";
import { Compartment } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { basicDark } from "@fsegurai/codemirror-theme-basic-dark";
import { basicLight } from "@fsegurai/codemirror-theme-basic-light";
import { basicSetup, EditorView } from "codemirror";
import { onCleanup, onMount } from "solid-js";
import { editorInstance } from "./create";

const Editor = (props: { content: string }) => {
  let editorDiv!: HTMLDivElement;
  let themeColor = new Compartment();
  let view: EditorView;

  const themeEvent = () => {
    view.dispatch({
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
      },
      "&": {
        height: "100%",
      },
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeEvent);

    view = new EditorView({
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
    editorInstance.view = view;
  });

  onCleanup(() =>
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", themeEvent),
  );

  return (
    <div
      ref={editorDiv}
      id="editor"
      class="h-full cursor-auto border-[0.5px] border-neutral-300 dark:border-neutral-700"
    ></div>
  );
};

export { Editor };
