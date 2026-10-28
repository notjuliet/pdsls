import { A } from "@solidjs/router";
import { For, Index, type JSX, Show } from "solid-js";

import { canHover } from "../../layout";
import { addToClipboard } from "../../lib/copy";
import { Favicon } from "../ui/favicon";
import Tooltip from "../ui/tooltip";

/** Something you can do with a stage: open a link or run an action. */
export interface StageAction {
  label: string;
  /** An iconify class, e.g. `lucide--rss`. */
  icon: string;
  href?: string;
  onClick?: () => void;
}

/** One level of the hierarchy, e.g. a PDS, a repo, a collection or a record. */
export interface Stage {
  /** What the stage is, e.g. "Repo"; omitted for a root like Spaces. */
  kind?: string;
  label: JSX.Element;
  labelClass?: string;
  /** Muted text after the label, e.g. a DID or a date. */
  detail?: JSX.Element;
  /** Links the row to its level; omitted for the current level. */
  href?: string;
  /** A domain whose favicon shows after the label, e.g. the app behind a collection. */
  favicon?: string;
  /** What the hover copy button copies, e.g. the repo's DID. */
  copy?: { label: string; value: string };
  /** Content before the actions, e.g. a button with its own state. */
  trailing?: JSX.Element;
  actions?: StageAction[];
}

/** The domain behind an NSID, e.g. `bsky.app` for `app.bsky.feed.post`. */
export const nsidDomain = (nsid: string) => nsid.split(".").slice(0, 2).reverse().join(".");

const iconLinkClass =
  "flex h-7 items-center rounded-md px-1.5 text-neutral-400 transition-colors hover:bg-neutral-200/70 hover:text-neutral-600 active:bg-neutral-300/70 dark:text-neutral-500 dark:hover:bg-neutral-700/70 dark:hover:text-neutral-300 dark:active:bg-neutral-600/70";

/** The longest kind any view uses, which sets the label column's width. */
const LONGEST_KIND = "Collection";

/** The row box's grid, shared with the invisible sizing row. */
const rowBoxClass = "grid grid-cols-subgrid items-baseline gap-x-4 px-2";

const kindClass = "relative text-left text-xs whitespace-nowrap";

const ActionIcon = (props: { action: StageAction }) => {
  const icon = () => <span class={`iconify ${props.action.icon}`} />;
  const trigger = () =>
    props.action.href ? (
      <A href={props.action.href} aria-label={props.action.label} class={iconLinkClass}>
        {icon()}
      </A>
    ) : (
      <button
        type="button"
        aria-label={props.action.label}
        class={iconLinkClass}
        onClick={() => props.action.onClick?.()}
      >
        {icon()}
      </button>
    );

  return (
    <span class="relative flex shrink-0 focus-within:z-20 hover:z-20">
      <Tooltip text={props.action.label}>{trigger()}</Tooltip>
    </span>
  );
};

const StageRow = (props: { stage: Stage; kindColumn: boolean; actionColumn: boolean }) => {
  return (
    // Rows share the nav's grid columns, so every label, value and action group lines up.
    <div class="col-span-full grid grid-cols-subgrid items-center">
      <div
        class={`group/row relative rounded-md py-0.5 transition-colors hover:bg-neutral-200/80 sm:py-0 dark:hover:bg-neutral-700/50 ${rowBoxClass}`}
        classList={{ "col-span-2": props.kindColumn }}
      >
        <Show when={props.stage.href}>
          {(href) => (
            <A href={href()} class="absolute inset-0 rounded-md">
              <span class="sr-only">Open {props.stage.kind ?? "level"}</span>
            </A>
          )}
        </Show>
        <Show when={props.kindColumn}>
          <span class={`pointer-events-none text-neutral-500 dark:text-neutral-400 ${kindClass}`}>
            {props.stage.kind}
          </span>
        </Show>
        <span class="pointer-events-none relative flex min-w-0 flex-wrap items-baseline gap-x-2 sm:flex-nowrap">
          <span
            class={`min-w-0 truncate py-0.5 font-medium ${props.stage.labelClass ?? ""}`}
            classList={{
              "sm:shrink-0 max-w-full": !!props.stage.detail,
              "text-blue-500 dark:text-blue-400": !!props.stage.href,
              "group-hover/row:text-blue-600 dark:group-hover/row:text-blue-300":
                !!props.stage.href,
            }}
          >
            {/* A space while the value loads keeps the row at its full height. */}
            {props.stage.label || "\u00a0"}
          </span>
          {/* Keyed so the favicon reloads when the domain changes. */}
          <Show when={props.stage.favicon} keyed>
            {(domain) => (
              <span class="flex shrink-0 self-center has-[img.hidden]:hidden">
                <Favicon domain={domain} noFallback wrapper={(icon) => icon} />
              </span>
            )}
          </Show>
          <Show when={props.stage.detail}>
            <span class="max-w-full min-w-0 truncate text-xs text-neutral-500 sm:text-sm dark:text-neutral-400">
              {props.stage.detail}
            </span>
          </Show>
          {/* Copy appears after the value on hover; phones copy from the Info and Identity tabs. */}
          <Show when={canHover && props.stage.copy}>
            {(copy) => (
              <span class="pointer-events-auto relative z-10 flex shrink-0 self-center opacity-0 transition-opacity group-hover/row:opacity-100 has-focus-visible:opacity-100">
                <Tooltip text={`Copy ${copy().label}`}>
                  <button
                    type="button"
                    aria-label={`Copy ${copy().label}`}
                    class="flex items-center p-0.5 text-neutral-400 transition-colors hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                    onClick={() => addToClipboard(copy().value)}
                  >
                    <span class="iconify lucide--copy text-sm" />
                  </button>
                </Tooltip>
              </span>
            )}
          </Show>
        </span>
      </div>
      <Show when={props.actionColumn}>
        <span class="flex items-center justify-end sm:gap-0.5">
          {props.stage.trailing}
          <For each={props.stage.actions}>{(action) => <ActionIcon action={action} />}</For>
        </span>
      </Show>
    </div>
  );
};

/** The navigation at the top of a page: one labeled row per level, its actions beside it. */
export const StageNav = (props: { stages: Stage[] }) => {
  const kindColumn = () => props.stages.some((item) => item.kind);
  // Without any actions there's no action column, so the rows reach the content's right edge.
  const actionColumn = () =>
    props.stages.some((item) => item.trailing || (item.actions?.length ?? 0) > 0);

  return (
    // The label column fits its longest label; the action column fits the widest action group.
    <nav
      class="grid w-full gap-x-1 text-sm wrap-anywhere sm:text-base"
      classList={{
        "grid-cols-[auto_minmax(0,1fr)_auto]": kindColumn() && actionColumn(),
        "grid-cols-[auto_minmax(0,1fr)]": kindColumn() && !actionColumn(),
        "grid-cols-[minmax(0,1fr)_auto]": !kindColumn() && actionColumn(),
        "grid-cols-[minmax(0,1fr)]": !kindColumn() && !actionColumn(),
      }}
    >
      {/* Index keeps each row mounted while its stage updates. */}
      <Index each={props.stages}>
        {(stage) => (
          <StageRow stage={stage()} kindColumn={kindColumn()} actionColumn={actionColumn()} />
        )}
      </Index>
      {/* An invisible row with the longest label keeps the column the same width at every
        level, so values don't shift as you go deeper. It copies the row box's grid, gap and
        padding so it sizes the column exactly like a real row. */}
      <Show when={kindColumn()}>
        <div aria-hidden="true" class={`invisible h-0 ${rowBoxClass} col-span-2`}>
          <span class={kindClass}>{LONGEST_KIND}</span>
        </div>
      </Show>
    </nav>
  );
};
