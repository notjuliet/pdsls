import { A } from "@solidjs/router";
import { createEffect, createSignal, type JSX, Match, Show, Switch } from "solid-js";

import { canHover } from "../layout";
import { addToClipboard } from "../utils/copy";
import Tooltip from "./tooltip";

/** The stacked hierarchy (PDS → repo → collection → record) at the top of a page. */
export const Breadcrumbs = (props: { children: JSX.Element }) => (
  <nav class="flex w-full flex-col text-sm wrap-anywhere sm:text-base">{props.children}</nav>
);

const CopyButton = (props: { content: string; label: string }) => (
  <Show when={canHover}>
    <Tooltip text={props.label}>
      <button
        type="button"
        onclick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          addToClipboard(props.content);
        }}
        class="pointer-events-none -mr-2 flex items-center rounded px-2 py-1 text-neutral-500 opacity-0 transition-all duration-200 group-hover/row:pointer-events-auto group-hover/row:opacity-100 hover:bg-neutral-200/70 hover:text-neutral-600 active:bg-neutral-300/70 sm:py-1.5 dark:text-neutral-400 dark:hover:bg-neutral-700/70 dark:hover:text-neutral-300 dark:active:bg-neutral-600/70"
        aria-label="Copy to clipboard"
      >
        <span class="iconify lucide--copy" />
      </button>
    </Tooltip>
  </Show>
);

/** Shows the domain's favicon in place of the icon while the row is hovered, once it has loaded. */
const HoverFavicon = (props: { domain: string; hovered: boolean; children: JSX.Element }) => {
  const [hasHovered, setHasHovered] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);
  const [src, setSrc] = createSignal("");
  let lastDomain = "";

  createEffect(() => {
    const domain = props.domain;
    if (!domain || domain === lastDomain) return;
    lastDomain = domain;
    setHasHovered(false);
    setLoaded(false);
    setSrc("");
  });

  createEffect(() => {
    if (props.hovered) setHasHovered(true);
  });

  const workerUrl = () => `/favicon?domain=${encodeURIComponent(props.domain)}`;
  const directUrl = () => `https://${props.domain}/favicon.ico`;

  return (
    <div class="relative flex h-5 w-3.5 shrink-0 items-center justify-center sm:w-4">
      <Show when={!props.hovered || !loaded()}>{props.children}</Show>
      <Show when={hasHovered() && props.domain}>
        <Switch>
          <Match when={props.domain === "tangled.sh" || props.domain === "tangled.org"}>
            <span
              class="iconify i-tangled size-4 text-neutral-900 dark:text-neutral-100"
              classList={{ hidden: !props.hovered || !loaded() }}
              ref={() => setLoaded(true)}
            />
          </Match>
          <Match when={true}>
            <img
              src={src() || workerUrl()}
              class="size-4"
              classList={{ hidden: !props.hovered || !loaded() }}
              onLoad={() => setLoaded(true)}
              onError={() => {
                if (!src()) setSrc(directUrl());
                else setLoaded(false);
              }}
            />
          </Match>
        </Switch>
      </Show>
    </div>
  );
};

interface BreadcrumbRowProps {
  /** An iconify class, e.g. `lucide--folder-open`. Ignored when `leading` is set. */
  icon?: string;
  /** Classes for the icon, replacing the default muted color. */
  iconClass?: string;
  leading?: JSX.Element;
  iconTooltip?: string;
  /** Swaps the icon for this domain's favicon on hover. */
  faviconDomain?: string;
  label: JSX.Element;
  labelClass?: string;
  /** Keeps the label from shrinking, so the detail truncates first. */
  preserveLabel?: boolean;
  /** Muted text after the label, e.g. a DID or a date. */
  detail?: JSX.Element;
  detailPrefix?: JSX.Element;
  /** Links the detail on its own, separately from the row. */
  detailHref?: string;
  /** Links the row to its level; omitted for the current level. */
  href?: string;
  copy?: { content: string; label: string };
  /** Content at the end of the row, e.g. a badge or buttons. */
  trailing?: JSX.Element;
}

export const BreadcrumbRow = (props: BreadcrumbRowProps) => {
  const [hovered, setHovered] = createSignal(false);
  const [detailHovered, setDetailHovered] = createSignal(false);

  const icon = () => (
    <Show
      when={props.leading}
      fallback={
        <span
          class={`iconify shrink-0 transition-colors duration-200 ${props.icon ?? ""} ${
            props.iconClass ??
            "text-neutral-500 group-hover/row:text-neutral-700 dark:text-neutral-400 dark:group-hover/row:text-neutral-200"
          }`}
        />
      }
    >
      {props.leading}
    </Show>
  );

  const leading = () => {
    const content = (
      <Show when={props.faviconDomain} fallback={icon()}>
        {(domain) => (
          <HoverFavicon domain={domain()} hovered={hovered()}>
            {icon()}
          </HoverFavicon>
        )}
      </Show>
    );
    return props.iconTooltip ? <Tooltip text={props.iconTooltip}>{content}</Tooltip> : content;
  };

  return (
    <div
      class="group/row relative flex min-h-6 w-full min-w-0 items-center gap-2 rounded-md border-[0.5px] border-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 sm:min-h-7 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40"
      onMouseEnter={() => canHover && setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setDetailHovered(false);
      }}
    >
      <Show when={props.href}>
        {(href) => (
          <A href={href()} class="absolute inset-0 rounded-md">
            <span class="sr-only">Open {props.label}</span>
          </A>
        )}
      </Show>
      <span class="relative flex shrink-0">{leading()}</span>
      <span
        class="pointer-events-none relative flex min-w-0 flex-1 items-baseline"
        classList={{ "gap-1": !!props.detailPrefix, "gap-2": !props.detailPrefix }}
      >
        <span
          class={`min-w-0 truncate py-0.5 font-medium ${props.labelClass ?? ""}`}
          classList={{
            "shrink-0 max-w-full": props.preserveLabel,
            "text-blue-500 transition-colors duration-150 dark:text-blue-400": !!props.href,
            "group-hover/row:text-blue-600 dark:group-hover/row:text-blue-300":
              !!props.href && !detailHovered(),
          }}
        >
          {props.label}
        </span>
        <Show when={props.detailPrefix}>
          <span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
            {props.detailPrefix}
          </span>
        </Show>
        <Show when={props.detail}>
          <Show
            when={props.detailHref}
            fallback={
              <span class="min-w-0 truncate text-xs font-normal text-neutral-500 sm:text-sm dark:text-neutral-400">
                {props.detail}
              </span>
            }
          >
            {(detailHref) => (
              <A
                href={detailHref()}
                class="pointer-events-auto relative z-10 min-w-0 truncate text-xs font-normal text-neutral-500 hover:text-blue-500 hover:underline sm:text-sm dark:text-neutral-400 dark:hover:text-blue-400"
                onMouseEnter={() => setDetailHovered(true)}
                onMouseLeave={() => setDetailHovered(false)}
              >
                {props.detail}
              </A>
            )}
          </Show>
        </Show>
      </span>
      <Show when={props.trailing}>
        <span class="relative z-10 flex shrink-0 items-center">{props.trailing}</span>
      </Show>
      <Show when={props.copy}>
        {(copy) => (
          <span class="relative z-10 flex shrink-0">
            <CopyButton content={copy().content} label={copy().label} />
          </span>
        )}
      </Show>
    </div>
  );
};
