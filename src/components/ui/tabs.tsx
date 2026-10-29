import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";

export interface TabItem {
  id: string;
  label: string;
  href: string;
  /** Marks the tab with a red cross, e.g. when a check on that tab failed. */
  error?: boolean;
  /** Marks the tab with a spinner while its content is still working, e.g. a check running. */
  loading?: boolean;
}

/** How far the fade at a scrolled edge reaches. */
const FADE = "1.5rem";

/**
 * The tabs at the top of a page, as pills; the current one is filled. When they don't fit,
 * they scroll sideways and fade at the edge that has more. `active` is the id of the current tab.
 */
export const Tabs = (props: { items: TabItem[]; active?: string; class?: string }) => {
  let scroller!: HTMLDivElement;
  const [overflow, setOverflow] = createSignal({ start: false, end: false });

  const measure = () => {
    const { scrollLeft, scrollWidth, clientWidth } = scroller;
    setOverflow({ start: scrollLeft > 1, end: scrollLeft + clientWidth < scrollWidth - 1 });
  };

  onMount(() => {
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    onCleanup(() => observer.disconnect());
  });

  // Brings the current tab into view, e.g. Backlinks opened from a link on a phone.
  createEffect(() => {
    const active = scroller.querySelector<HTMLElement>(`[data-tab="${props.active}"]`);
    if (!active) return;
    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    if (left < scroller.scrollLeft) scroller.scrollLeft = left;
    else if (right > scroller.scrollLeft + scroller.clientWidth)
      scroller.scrollLeft = right - scroller.clientWidth;
    measure();
  });

  const mask = () => {
    const { start, end } = overflow();
    if (!start && !end) return undefined;
    return `linear-gradient(to right, ${start ? `transparent, black ${FADE}` : "black"}, ${
      end ? `black calc(100% - ${FADE}), transparent` : "black"
    })`;
  };

  return (
    // Pulled into the padding so the first tab's text lines up with the content below.
    <div
      ref={scroller}
      onScroll={measure}
      class={`-ml-2 flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto ${props.class ?? ""}`}
      style={{ "mask-image": mask() }}
    >
      <For each={props.items}>
        {(tab) => (
          // A plain link: the router still handles the click, and A would mark every tab as the
          // current page, since tabs share a path and differ only by hash.
          <a
            href={tab.href}
            data-tab={tab.id}
            aria-current={props.active === tab.id ? "page" : undefined}
            class="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium whitespace-nowrap transition-colors sm:py-0.5"
            classList={{
              "dark:bg-dark-100 bg-white text-neutral-900 ring-1 ring-neutral-300/70 ring-inset dark:text-neutral-100 dark:ring-neutral-500/70":
                props.active === tab.id,
              "text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900 dark:text-neutral-300/80 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-100":
                props.active !== tab.id,
            }}
          >
            {tab.label}
            <Show
              when={tab.error}
              fallback={
                <Show when={tab.loading}>
                  <span class="iconify lucide--loader-circle animate-spin text-neutral-500 dark:text-neutral-400" />
                </Show>
              }
            >
              <span class="iconify lucide--x text-red-500 dark:text-red-400" />
            </Show>
          </a>
        )}
      </For>
    </div>
  );
};
