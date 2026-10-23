import { A } from "@solidjs/router";
import { For, Show } from "solid-js";

export interface TabItem {
  id: string;
  label: string;
  href: string;
  /** Marks the tab with a red cross, e.g. when a check on that tab failed. */
  error?: boolean;
}

/** The underlined link tabs at the top of a page. `active` is the id of the current tab. */
export const Tabs = (props: { items: TabItem[]; active?: string; class?: string }) => (
  <div class={`flex items-center gap-3 sm:gap-4 ${props.class ?? ""}`}>
    <For each={props.items}>
      {(tab) => (
        <div class="flex items-center gap-0.5">
          <A
            href={tab.href}
            classList={{
              "border-b-2 font-medium transition-colors": true,
              "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
                props.active !== tab.id,
            }}
          >
            {tab.label}
          </A>
          <Show when={tab.error}>
            <span class="iconify lucide--x text-red-500 dark:text-red-400" />
          </Show>
        </div>
      )}
    </For>
  </div>
);
