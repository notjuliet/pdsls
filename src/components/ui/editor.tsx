import type { Handle } from "@atcute/lexicons";
import { isHandle } from "@atcute/lexicons/syntax";
import {
  closeCompletion,
  completionStatus,
  pickedCompletion,
  startCompletion,
} from "@codemirror/autocomplete";
import type { Completion, CompletionSource } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { json, jsonLanguage, jsonParseLinter } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { linter } from "@codemirror/lint";
import type { LintSource } from "@codemirror/lint";
import { keymap, tooltips } from "@codemirror/view";
import type { KeyBinding } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup, EditorView } from "codemirror";
import { onCleanup, onMount } from "solid-js";

import { resolveHandle } from "../../lib/api";

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
  ".cm-tooltip.cm-tooltip-autocomplete": {
    padding: "4px",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.15)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "inherit",
    minWidth: "240px",
    maxWidth: "min(480px, calc(100vw - 32px))",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "baseline",
    gap: "16px",
    padding: "4px 8px",
    borderRadius: "4px",
    lineHeight: "16px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    color: "var(--cm-fg)",
    backgroundColor: "var(--cm-selection)",
  },
  ".cm-completionIcon": { display: "none" },
  ".cm-completionLabel": { flexShrink: "0", fontWeight: "500" },
  ".cm-completionDetail": {
    marginLeft: "auto",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontStyle: "normal",
    color: "var(--cm-muted)",
  },
  ".cm-tooltip-autocomplete li[aria-selected] .cm-completionDetail": { color: "var(--cm-fg)" },
});

// Matches the record viewer: indigo keys, amber booleans, muted null and punctuation.
const highlighting = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--cm-key)" },
  { tag: tags.bool, color: "var(--cm-bool)" },
  { tag: tags.null, color: "var(--cm-muted)" },
  { tag: [tags.brace, tags.squareBracket, tags.separator], color: "var(--cm-punct)" },
  { tag: tags.invalid, color: "var(--cm-invalid)" },
]);

/** Puts a JSON value at the cursor, in whatever form suits the text around it. */
const insertValue = (
  view: EditorView,
  value: unknown,
  target?: { from: number; to: number },
  completion?: Completion,
) => {
  const { from, to } = target ?? view.state.selection.main;
  const node = syntaxTree(view.state).resolveInner(from, 0);
  const inString = (node.name === "String" || node.name === "PropertyName") && to < node.to;

  let range = { from, to };
  let text = JSON.stringify(value, null, 2);
  if (inString) {
    // Text joins the string; anything else can't live in one, so it takes the string's place.
    if (typeof value === "string") text = text.slice(1, -1);
    else range = { from: node.from, to: node.to };
  }

  const indent = /^\s*/.exec(view.state.doc.lineAt(range.from).text)![0];
  const insert = text.replaceAll("\n", `\n${indent}`);
  view.dispatch({
    changes: { ...range, insert },
    selection: { anchor: range.from + insert.length },
    scrollIntoView: true,
    annotations: completion && pickedCompletion.of(completion),
  });
  view.focus();
};

/** A row that only informs, so picking it just closes the list. */
const noticeCompletion = (label: string, detail: string): Completion => ({
  label,
  detail,
  apply: (view) => closeCompletion(view),
});

/** The latest handle looked up from the list, with its DID once known, or null if it has none. */
let lookup: { handle: string; did?: string | null } | undefined;

const lookUpHandle = (handle: string, text: string, view: EditorView) => {
  const current: NonNullable<typeof lookup> = { handle };
  lookup = current;
  // Waits for a pause in typing, since each lookup goes out to DNS.
  setTimeout(async () => {
    if (lookup !== current) return;
    current.did = await resolveHandle(handle as Handle).catch(() => null);
    // Fills in the list, unless it was closed or the text has moved on.
    const { head } = view.state.selection.main;
    if (
      lookup === current &&
      completionStatus(view.state) &&
      view.state.sliceDoc(head - text.length, head) === text
    ) {
      startCompletion(view);
    }
  }, 300);
};

/** Typing @ offers the current time, and a full handle's DID. */
const atCompletions: CompletionSource = (context) => {
  const match = context.matchBefore(/@[a-zA-Z0-9.-]*/);
  // A letter before the @ means something else, e.g. an email address.
  if (!match || /\w/.test(context.state.sliceDoc(match.from - 1, match.from))) return null;
  const query = match.text.slice(1);

  const options: Completion[] = [];
  if ("now".startsWith(query.toLowerCase())) {
    options.push({
      label: "@now",
      detail: new Date().toISOString(),
      boost: 1,
      apply: (view, completion, from, to) =>
        insertValue(view, new Date().toISOString(), { from, to }, completion),
    });
  }

  if (isHandle(query)) {
    if (lookup?.handle !== query && context.view) lookUpHandle(query, match.text, context.view);
    const did = lookup?.handle === query ? lookup.did : undefined;
    if (did) {
      options.push({
        label: match.text,
        detail: did,
        apply: (view, completion, from, to) => insertValue(view, did, { from, to }, completion),
      });
    } else {
      options.push(
        noticeCompletion(match.text, did === null ? "No DID found" : "Resolving handle…"),
      );
    }
  } else {
    options.push(noticeCompletion("@handle", "Type a full handle for its DID"));
  }

  return { from: match.from, options, filter: false };
};

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
        jsonLanguage.data.of({ autocomplete: atCompletions }),
        // Keeps the autocomplete list off the screen's edges.
        tooltips({
          tooltipSpace: () => ({
            top: 8,
            left: 8,
            bottom: window.innerHeight - 8,
            right: window.innerWidth - 8,
          }),
        }),
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

export { Editor, insertValue };
