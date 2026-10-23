import * as TID from "@atcute/tid";
import { A } from "@solidjs/router";
import { type JSX, Show } from "solid-js";

import { localDateFromTimestamp } from "../utils/format.js";
import HoverCard from "./hover-card/base.jsx";
import { JSONValue, type JSONType } from "./json.jsx";

interface RecordRowProps {
  rkey: string;
  cid: string;
  /** Shown in the hover preview; undefined when the source returned no value. */
  value: JSONType | undefined;
  repo: string;
  /** Navigates to the record. Ignored when `onClick` is set. */
  href?: string;
  /** Replaces navigation, e.g. to toggle selection. */
  onClick?: (event: MouseEvent) => void;
  /** A field of the record shown on a second line. */
  preview?: { field: string; value: string };
  selected?: boolean;
  /** Whether the neighboring rows are selected, so a run of selected rows reads as one block. */
  prevSelected?: boolean;
  nextSelected?: boolean;
}

const timestampFromRkey = (rkey: string) => {
  if (!TID.validate(rkey)) return;
  const timestamp = TID.parse(rkey).timestamp / 1000;
  return timestamp <= Date.now() ? timestamp : undefined;
};

export const RecordRow = (props: RecordRowProps) => {
  const timestamp = () => timestampFromRkey(props.rkey);

  const rowClass = () => {
    if (!props.selected) {
      return "rounded hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600";
    }
    const rounding = `${props.prevSelected ? "" : "rounded-t"} ${props.nextSelected ? "" : "rounded-b"}`;
    return `bg-blue-200 hover:bg-blue-300/80 active:bg-blue-300 dark:bg-blue-700/30 dark:hover:bg-blue-700/50 dark:active:bg-blue-700/70 ${rounding}`;
  };

  const content = (): JSX.Element => (
    <>
      <span class="flex w-full min-w-0 items-baseline">
        <span class="max-w-full shrink-0 truncate text-sm text-blue-500 dark:text-blue-400">
          {props.rkey}
        </span>
        <span class="ml-1 truncate text-xs text-neutral-400 dark:text-neutral-500" dir="rtl">
          {props.cid}
        </span>
        <Show when={timestamp()}>
          {(value) => (
            <span class="ml-1 shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
              {localDateFromTimestamp(value())}
            </span>
          )}
        </Show>
      </span>
      <Show when={props.preview}>
        {(preview) => (
          <span class="flex w-full min-w-0 items-baseline gap-1 text-xs">
            <span class="shrink-0 text-neutral-500 dark:text-neutral-400">{preview().field}:</span>
            <span class="min-w-0 truncate">{preview().value}</span>
          </span>
        )}
      </Show>
    </>
  );

  const triggerClass = "flex w-full min-w-0 flex-col px-1 py-0.5 text-left select-none";

  return (
    <HoverCard
      class={`flex w-full min-w-0 ${rowClass()}`}
      activeClass={
        props.selected ? "bg-blue-300/80 dark:bg-blue-700/50" : "bg-neutral-200 dark:bg-neutral-700"
      }
      previewPlacement="side"
      trigger={
        <Show
          when={props.onClick}
          fallback={
            <A href={props.href ?? ""} class={triggerClass}>
              {content()}
            </A>
          }
        >
          {(onClick) => (
            <button
              type="button"
              aria-pressed={props.selected}
              onClick={(event) => onClick()(event)}
              class={triggerClass}
            >
              {content()}
            </button>
          )}
        </Show>
      }
    >
      <Show
        when={props.value !== undefined}
        fallback={
          <span class="text-sm text-neutral-500 dark:text-neutral-400">No value returned</span>
        }
      >
        <JSONValue data={props.value!} repo={props.repo} truncate hideBlobs preview />
      </Show>
    </HoverCard>
  );
};
