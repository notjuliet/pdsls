import type { Nsid } from "@atcute/lexicons";
import { A } from "@solidjs/router";
import { createResource, createSignal, For, Index, type JSX, Show } from "solid-js";

import { canHover } from "../../layout";
import { addToClipboard } from "../../lib/copy";
import { resolveLexicon, schemaHref } from "../../lib/lexicon";
import LexiconHoverCard from "../hover-card/lexicon";
import Tooltip from "../ui/tooltip";

/** Something you can do with a stage: open a link or run an action. */
export interface StageAction {
  label: string;
  /** An iconify class, e.g. `lucide--rss`. */
  icon: string;
  href?: string;
  onClick?: () => void;
  /** Draws the icon faded, e.g. when the target is known to be missing. */
  dimmed?: boolean;
  /** Wraps the icon, e.g. in a hover preview. */
  wrap?: (trigger: JSX.Element) => JSX.Element;
}

/** One level of the hierarchy, e.g. a PDS, a repo, a collection or a record. */
export interface Stage {
  /** What the stage is, e.g. "Repo"; omitted for a root like Spaces. */
  kind?: string;
  label: JSX.Element;
  labelClass?: string;
  /** Muted text after the label, e.g. a DID or a date. */
  detail?: JSX.Element;
  /** Links the detail on its own, separately from the row. */
  detailHref?: string;
  /** Links the row to its level; omitted for the current level. */
  href?: string;
  /** Extra content after the label, e.g. a badge. */
  badge?: JSX.Element;
  /** What tapping the kind copies, e.g. the repo's DID. */
  copy?: { label: string; value: string };
  /** Content before the actions, e.g. a button with its own state. */
  trailing?: JSX.Element;
  actions?: StageAction[];
}

const iconLinkClass =
  "flex items-center rounded px-1.5 py-1 text-neutral-400 transition-colors hover:bg-neutral-200/70 hover:text-neutral-600 active:bg-neutral-300/70 sm:py-1.5 dark:text-neutral-500 dark:hover:bg-neutral-700/70 dark:hover:text-neutral-300 dark:active:bg-neutral-600/70";

const kindClass = "relative w-16 shrink-0 text-left text-xs sm:w-20";

const ActionIcon = (props: { action: StageAction }) => {
  const icon = () => (
    <span
      class={`iconify ${props.action.icon}`}
      classList={{ "opacity-40": props.action.dimmed }}
    />
  );
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
      {props.action.wrap ? (
        props.action.wrap(trigger())
      ) : (
        <Tooltip text={props.action.label}>{trigger()}</Tooltip>
      )}
    </span>
  );
};

/** The stage's kind, which copies its value when it has one. */
const StageKind = (props: { stage: Stage }) => (
  <Show
    when={props.stage.copy}
    fallback={
      <span class={`pointer-events-none text-neutral-500 dark:text-neutral-400 ${kindClass}`}>
        {props.stage.kind}
      </span>
    }
  >
    {(copy) => {
      const button = (
        <button
          type="button"
          aria-label={`Copy ${copy().label}`}
          class={`group/kind z-10 flex items-baseline gap-1 text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 ${kindClass}`}
          onClick={() => addToClipboard(copy().value)}
        >
          {props.stage.kind}
          <Show when={canHover}>
            <span class="iconify lucide--copy shrink-0 self-center opacity-0 transition-opacity group-hover/kind:opacity-100" />
          </Show>
        </button>
      );
      return canHover ? <Tooltip text={`Copy ${copy().label}`}>{button}</Tooltip> : button;
    }}
  </Show>
);

const StageRow = (props: { stage: Stage; kindColumn: boolean }) => {
  const [detailHovered, setDetailHovered] = createSignal(false);

  return (
    <div class="flex w-full min-w-0 items-center gap-1">
      <div
        class="group/row relative flex min-h-7 min-w-0 flex-1 items-baseline gap-2 rounded-md px-2 transition-colors hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40"
        onMouseLeave={() => setDetailHovered(false)}
      >
        <Show when={props.stage.href}>
          {(href) => (
            <A href={href()} class="absolute inset-0 rounded-md">
              <span class="sr-only">Open {props.stage.label}</span>
            </A>
          )}
        </Show>
        <Show when={props.kindColumn}>
          <StageKind stage={props.stage} />
        </Show>
        <span class="pointer-events-none relative flex min-w-0 flex-1 items-baseline gap-2">
          <span
            class={`min-w-0 truncate py-0.5 font-medium ${props.stage.labelClass ?? ""}`}
            classList={{
              "shrink-0 max-w-full": !!props.stage.detail,
              "text-blue-500 dark:text-blue-400": !!props.stage.href,
              "group-hover/row:text-blue-600 dark:group-hover/row:text-blue-300":
                !!props.stage.href && !detailHovered(),
            }}
          >
            {props.stage.label}
          </span>
          <Show when={props.stage.badge}>
            <span class="flex shrink-0 self-center">{props.stage.badge}</span>
          </Show>
          <Show when={props.stage.detail}>
            <Show
              when={props.stage.detailHref}
              fallback={
                <span class="min-w-0 truncate text-xs text-neutral-500 sm:text-sm dark:text-neutral-400">
                  {props.stage.detail}
                </span>
              }
            >
              {(detailHref) => (
                <A
                  href={detailHref()}
                  class="pointer-events-auto relative z-10 min-w-0 truncate text-xs text-neutral-500 hover:text-blue-500 hover:underline sm:text-sm dark:text-neutral-400 dark:hover:text-blue-400"
                  onMouseEnter={() => setDetailHovered(true)}
                  onMouseLeave={() => setDetailHovered(false)}
                >
                  {props.stage.detail}
                </A>
              )}
            </Show>
          </Show>
        </span>
      </div>
      <Show when={props.stage.trailing || props.stage.actions?.length}>
        <span class="flex shrink-0 items-center pr-2 sm:gap-0.5">
          {props.stage.trailing}
          <For each={props.stage.actions}>{(action) => <ActionIcon action={action} />}</For>
        </span>
      </Show>
    </div>
  );
};

/** The navigation at the top of a page: one labeled row per level, its actions beside it. */
export const StageNav = (props: { stages: Stage[] }) => (
  <nav class="flex w-full flex-col text-sm wrap-anywhere sm:text-base">
    {/* Index keeps each row mounted while its stage updates. */}
    <Index each={props.stages}>
      {(stage) => <StageRow stage={stage()} kindColumn={props.stages.some((item) => item.kind)} />}
    </Index>
  </nav>
);

/**
 * The schema action for a collection: previews its lexicon on hover and dims when none is
 * published. Resolving starts right away (cached per NSID) so the preview opens instantly.
 */
export const useSchemaAction = (
  nsid: () => string | undefined,
): (() => StageAction | undefined) => {
  const [lexicon] = createResource(nsid, (value) => resolveLexicon(value as Nsid));

  return () => {
    const value = nsid();
    if (!value) return undefined;
    return {
      label: "Schema",
      icon: "lucide--book-text",
      href: schemaHref(value),
      dimmed: !!lexicon.error,
      wrap: (trigger) => <LexiconHoverCard lexicon={value} renderTrigger={() => trigger} />,
    };
  };
};
