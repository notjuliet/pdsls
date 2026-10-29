import { type JSX, Show } from "solid-js";

import { canHover } from "../../layout.jsx";
import { addToClipboard } from "../../lib/copy.js";

/** A section heading's text, for a heading that shares its line, e.g. with a count and a button. */
export const HEADING_TEXT_CLASS = "text-sm font-medium text-neutral-800 dark:text-neutral-200";
/** A section heading in an info tab, like Identity's "Services". */
export const HEADING_CLASS = `mb-1 ${HEADING_TEXT_CLASS}`;

/**
 * The label before a value in a row. A minimum width lines up the values after it; a longer label
 * only pushes its own row.
 */
export const LABEL_COLUMN_CLASS = "min-w-20 shrink-0 font-sans";
/** Lines under a row's value, e.g. a check's error, start where the values do: the label column and the row's gap. */
export const UNDER_VALUE_CLASS = "pl-21";
export const MUTED_CLASS = "text-neutral-500 dark:text-neutral-400";
export const VALUE_CLASS = "text-neutral-700 dark:text-neutral-300";

/** How many characters stay visible at the end of a value cut in the middle. */
const VISIBLE_END = 8;

/** A titled section of an info tab. */
export const InfoSection = (props: { title: string; children: JSX.Element }) => (
  <section>
    <h3 class={HEADING_CLASS}>{props.title}</h3>
    {props.children}
  </section>
);

/**
 * A muted label and its value on one line, the values lined up across rows. Text values sit on
 * the label's baseline; `center` centers a value that's only an icon on the label instead.
 */
export const InfoRow = (props: {
  label: string;
  title?: string;
  center?: boolean;
  /** In place of the label column's class, e.g. to widen it for a longer label above the rows. */
  labelClass?: string;
  children: JSX.Element;
}) => (
  <div
    class="flex gap-1 text-sm"
    classList={{ "items-baseline": !props.center, "items-center": props.center }}
  >
    <span class={`${props.labelClass ?? LABEL_COLUMN_CLASS} ${MUTED_CLASS}`}>{props.label}</span>
    <span class={`min-w-0 wrap-anywhere ${VALUE_CLASS}`} title={props.title}>
      {props.children}
    </span>
  </div>
);

/**
 * A long value on one line that copies on click. It's cut in the middle, so both ends stay
 * readable, e.g. to compare keys. `copy` is copied instead of the shown value.
 */
export const CopyValue = (props: {
  value: string;
  copy?: string;
  mono?: boolean;
  /** A muted label before the value, like a key's type, in a fixed width so values line up. */
  label?: string;
  /** Leaves out the copy icon on touch screens, where it would show on every row; a tap still copies. */
  quiet?: boolean;
}) => (
  <button
    type="button"
    title={props.value}
    class="group flex w-full min-w-0 items-center gap-1 text-left text-sm text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-200"
    classList={{ "font-mono": props.mono }}
    onClick={() => addToClipboard(props.copy ?? props.value)}
  >
    <Show when={props.label}>
      <span class={`${LABEL_COLUMN_CLASS} ${MUTED_CLASS}`}>{props.label}</span>
    </Show>
    <span class="flex min-w-0">
      <span class="truncate">{props.value.slice(0, -VISIBLE_END)}</span>
      <span class="shrink-0">{props.value.slice(-VISIBLE_END)}</span>
    </span>
    <Show when={canHover || !props.quiet}>
      <span
        class="iconify lucide--copy shrink-0 font-sans"
        classList={{ "opacity-0 group-hover:opacity-100": canHover }}
      />
    </Show>
  </button>
);
