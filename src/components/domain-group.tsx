import { type JSX, Show } from "solid-js";

import { Favicon } from "./favicon.jsx";

type DomainGroupProps = {
  domain: string;
  domainTitle?: string;
  groupLabel: string;
  children: JSX.Element;
  collapsed: boolean;
  collapsedLabel: JSX.Element;
  onToggle: () => void;
  sticky?: boolean;
};

type DomainGroupRowsProps = {
  children: JSX.Element;
  as?: "div" | "ul";
};

export const domainGroupRowClasses = "min-h-6 px-2 py-0.5";

export const DomainGroupRows = (props: DomainGroupRowsProps) => {
  const classes = "flex min-w-0 flex-col";
  return props.as === "ul" ? (
    <ul class={classes}>{props.children}</ul>
  ) : (
    <div class={classes}>{props.children}</div>
  );
};

const stickyHeaderClasses =
  "sticky top-0 z-10 bg-neutral-100 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-1 after:h-1 after:bg-linear-to-b after:from-neutral-100 after:via-neutral-100/75 after:to-transparent after:content-[''] sm:bg-transparent sm:bg-linear-to-b sm:from-neutral-100 sm:from-[70%] sm:to-transparent sm:after:hidden dark:bg-dark-500 dark:after:from-dark-500 dark:after:via-dark-500/75 dark:sm:bg-transparent dark:sm:from-dark-500";

export const DomainGroup = (props: DomainGroupProps) => (
  <div class="grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-2 sm:border-t sm:border-neutral-200 sm:py-1 sm:first:border-t-0 sm:first:pt-0 sm:last:pb-0 dark:sm:border-neutral-700/60">
    <div class={`relative min-w-0 self-start ${props.sticky ? stickyHeaderClasses : ""}`}>
      <button
        type="button"
        class="group/domain block min-h-6 w-full min-w-0 cursor-pointer py-0.5 text-left focus-visible:outline-none active:opacity-70"
        aria-expanded={!props.collapsed}
        aria-label={`${props.collapsed ? "Expand" : "Collapse"} ${props.domain} ${props.groupLabel}`}
        onClick={props.onToggle}
      >
        <div class="flex min-w-0 items-center gap-2">
          <Favicon domain={props.domain} />
          <span
            class="min-w-0 truncate text-sm font-medium text-neutral-600 transition-colors group-focus-visible/domain:text-neutral-900 group-focus-visible/domain:underline sm:group-hover/domain:text-neutral-900 sm:group-hover/domain:underline dark:text-neutral-300 dark:group-focus-visible/domain:text-neutral-100 dark:sm:group-hover/domain:text-neutral-100"
            title={props.domainTitle ?? props.domain}
          >
            {props.domain}
          </span>
          <span class="h-px min-w-4 flex-1 bg-neutral-200 sm:hidden dark:bg-neutral-700" />
        </div>
      </button>
    </div>
    <div class="min-w-0 pl-4 sm:pl-0">
      <Show
        when={!props.collapsed}
        fallback={
          <button
            type="button"
            class="flex min-h-6 w-full items-center px-2 text-left text-sm text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            aria-label={`Expand ${props.domain} ${props.groupLabel}`}
            onClick={props.onToggle}
          >
            {props.collapsedLabel}
          </button>
        }
      >
        {props.children}
      </Show>
    </div>
  </div>
);
