import { indentWithTab } from "@codemirror/commands";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { linter } from "@codemirror/lint";
import type { LintSource } from "@codemirror/lint";
import { keymap } from "@codemirror/view";
import type { KeyBinding } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup, EditorView } from "codemirror";
import { onCleanup, onMount } from "solid-js";

const tabIndentKey = indentWithTab as unknown as KeyBinding;
const jsonLinter = jsonParseLinter() as unknown as LintSource;

// Colours come from the --cm-* variables in styles/index.css, so the editor follows the app's
// light and dark mode without reconfiguring.
const theme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--cm-fg)",
    backgroundColor: "var(--cm-bg)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
  ".cm-content": {
    fontFamily: "'Roboto Mono', monospace",
    fontSize: "12px",
    caretColor: "var(--cm-fg)",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--cm-fg)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "var(--cm-selection)" },
  ".cm-activeLine": { backgroundColor: "var(--cm-active)" },
  ".cm-line": { paddingLeft: "8px" },
  ".cm-gutters": {
    color: "var(--cm-muted)",
    backgroundColor: "var(--cm-bg)",
    border: "none",
    borderRight: "0.5px solid var(--cm-border)",
  },
  // Inside the last column, so the active line's highlight reaches the divider.
  ".cm-foldGutter .cm-gutterElement": { paddingRight: "4px" },
  ".cm-activeLineGutter": { color: "var(--cm-fg)", backgroundColor: "var(--cm-active)" },
  "&.cm-focused .cm-matchingBracket": {
    backgroundColor: "var(--cm-match)",
    outline: "none",
  },
  ".cm-foldPlaceholder": {
    color: "var(--cm-muted)",
    backgroundColor: "transparent",
    border: "1px solid var(--cm-border)",
  },
  ".cm-searchMatch, .cm-selectionMatch": { backgroundColor: "var(--cm-match)" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--cm-selection)" },
  ".cm-panels": {
    color: "var(--cm-fg)",
    backgroundColor: "var(--cm-panel)",
    fontSize: "12px",
  },
  ".cm-panel.cm-panel-lint ul:focus": { outline: "none" },
  ".cm-panel.cm-panel-lint ul [aria-selected], .cm-panel.cm-panel-lint ul:focus [aria-selected]": {
    color: "var(--cm-fg)",
    backgroundColor: "var(--cm-selection)",
  },
  ".cm-panels-bottom": { borderTop: "0.5px solid var(--cm-border)" },
  ".cm-panels-top": { borderBottom: "0.5px solid var(--cm-border)" },
  // The search panel's fields and buttons, which otherwise keep CodeMirror's light defaults.
  ".cm-textfield, .cm-button": {
    color: "var(--cm-fg)",
    border: "0.5px solid var(--cm-border)",
    borderRadius: "6px",
    fontSize: "12px",
  },
  ".cm-textfield": {
    backgroundColor: "var(--cm-bg)",
    padding: "3px 6px",
  },
  ".cm-textfield:focus": {
    outline: "1px solid var(--cm-muted)",
    outlineOffset: "0",
  },
  ".cm-button": {
    backgroundColor: "transparent",
    backgroundImage: "none",
    padding: "3px 8px",
    cursor: "pointer",
  },
  ".cm-button:hover": { backgroundColor: "var(--cm-active)" },
  ".cm-button:active": { backgroundColor: "var(--cm-match)", backgroundImage: "none" },
  ".cm-panel.cm-search": { padding: "6px 28px 6px 6px" },
  ".cm-panel.cm-search label": {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    verticalAlign: "middle",
    margin: ".2em .6em 0 .2em",
  },
  ".cm-panel.cm-search input[type=checkbox]": { accentColor: "var(--color-blue-500)", margin: "0" },
  ".cm-panel button[name=close]": {
    color: "var(--cm-muted)",
    fontSize: "16px",
    cursor: "pointer",
  },
  ".cm-panel button[name=close]:hover": { color: "var(--cm-fg)" },
  ".cm-tooltip": {
    color: "var(--cm-fg)",
    backgroundColor: "var(--cm-panel)",
    border: "0.5px solid var(--cm-border)",
    borderRadius: "6px",
    overflow: "hidden",
    fontSize: "12px",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    color: "var(--cm-fg)",
    backgroundColor: "var(--cm-selection)",
  },
});

// Matches the record viewer: indigo keys, amber booleans, muted null and punctuation.
const highlighting = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--cm-key)" },
  { tag: tags.bool, color: "var(--cm-bool)" },
  { tag: tags.null, color: "var(--cm-muted)" },
  { tag: [tags.brace, tags.squareBracket, tags.separator], color: "var(--cm-punct)" },
  { tag: tags.invalid, color: "var(--cm-invalid)" },
]);

const Editor = (props: {
  content: string;
  onReady?: (view: EditorView | undefined) => void;
  onChange?: (doc: string) => void;
}) => {
  let editorDiv!: HTMLDivElement;
  let view: EditorView;

  onMount(() => {
    view = new EditorView({
      doc: props.content,
      parent: editorDiv,
      extensions: [
        basicSetup,
        theme,
        syntaxHighlighting(highlighting),
        json(),
        keymap.of([tabIndentKey]),
        linter(jsonLinter),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) props.onChange?.(update.state.doc.toString());
        }),
      ],
    });
    props.onReady?.(view);
  });

  onCleanup(() => {
    props.onReady?.(undefined);
    view?.destroy();
  });

  return (
    <div
      ref={editorDiv}
      id="editor"
      class="h-full cursor-auto overflow-hidden rounded-md border-[0.5px] border-neutral-300 dark:border-neutral-700"
    ></div>
  );
};

export { Editor };
