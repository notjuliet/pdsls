import { A } from "@solidjs/router";
import { createMemo, createSignal, For, type JSX, onMount, Show } from "solid-js";

import { useFilterShortcut } from "../../lib/keyboard.js";
import { DomainGroup, DomainGroupRows, domainGroupRowClasses } from "../ui/domain-group.jsx";
import { FilterInput } from "../ui/filter-input.jsx";
import Tooltip from "../ui/tooltip.jsx";

export interface CollectionItem {
  nsid: string;
  /** Record count, shown on the right when known. */
  count?: number | string;
  href: string;
}

interface CollectionListProps {
  collections: CollectionItem[];
  filter?: string;
  /** Shared collapse state, e.g. for expand/collapse all; when omitted the list keeps its own. */
  collapse?: CollapseState;
  /** Shown when no collection matches. */
  fallback?: JSX.Element;
}

export const nsidAuthority = (nsid: string) => nsid.split(".").slice(0, 2).join(".");

/** Which domain groups of a CollectionList are collapsed. */
export const createCollapseState = () => {
  const [collapsed, setCollapsed] = createSignal(new Set<string>());
  return {
    isCollapsed: (authority: string) => collapsed().has(authority),
    toggle: (authority: string) =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(authority)) next.delete(authority);
        else next.add(authority);
        return next;
      }),
    collapseAll: (nsids: string[]) => setCollapsed(new Set(nsids.map(nsidAuthority))),
    allCollapsed: (nsids: string[]) =>
      nsids.length > 0 && nsids.every((nsid) => collapsed().has(nsidAuthority(nsid))),
    expandAll: () => setCollapsed(new Set<string>()),
  };
};

export type CollapseState = ReturnType<typeof createCollapseState>;

export const displayNsidDomain = (authority: string) => authority.split(".").reverse().join(".");

export const CollectionList = (props: CollectionListProps) => {
  const collapse = props.collapse ?? createCollapseState();

  const groups = createMemo(() => {
    const filter = props.filter?.toLowerCase().trim();
    const grouped = new Map<string, CollectionItem[]>();

    for (const item of props.collections) {
      const authority = nsidAuthority(item.nsid);
      const matches =
        !filter ||
        item.nsid.toLowerCase().includes(filter) ||
        displayNsidDomain(authority).toLowerCase().includes(filter);
      if (!matches) continue;
      grouped.set(authority, [...(grouped.get(authority) ?? []), item]);
    }

    return Array.from(grouped, ([authority, items]) => ({
      authority,
      domain: displayNsidDomain(authority),
      items: items.sort((a, b) => a.nsid.localeCompare(b.nsid)),
    })).sort((a, b) => a.domain.localeCompare(b.domain));
  });

  const rowClass = `flex w-full min-w-0 items-baseline gap-2 text-left hover:underline active:underline ${domainGroupRowClasses}`;

  const rowContent = (authority: string, item: CollectionItem): JSX.Element => (
    <>
      <span class="truncate">
        <span class="text-neutral-500 dark:text-neutral-400">{authority}.</span>
        {item.nsid.slice(authority.length + 1)}
      </span>
      <Show when={item.count !== undefined}>
        <span class="ml-auto shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
          {typeof item.count === "number" ? item.count.toLocaleString() : item.count}
        </span>
      </Show>
    </>
  );

  return (
    <Show when={groups().length > 0} fallback={props.fallback}>
      <div class="flex flex-col gap-1 text-sm wrap-anywhere sm:gap-0">
        <For each={groups()}>
          {(group) => (
            <DomainGroup
              domain={group.domain}
              domainTitle={`${group.domain} (${group.authority})`}
              groupLabel="collections"
              sticky
              collapsed={collapse.isCollapsed(group.authority)}
              collapsedLabel={
                <>
                  {group.items.length} {group.items.length === 1 ? "collection" : "collections"}
                </>
              }
              onToggle={() => collapse.toggle(group.authority)}
            >
              <DomainGroupRows as="ul">
                <For each={group.items}>
                  {(item) => (
                    <li>
                      <A href={item.href} class={rowClass} title={item.nsid}>
                        {rowContent(group.authority, item)}
                      </A>
                    </li>
                  )}
                </For>
              </DomainGroupRows>
            </DomainGroup>
          )}
        </For>
      </div>
    </Show>
  );
};

/** The fixed panel under a collection list: the filter (focused with "/") and a collapse/expand all toggle. */
export const CollectionListControls = (props: {
  filter: string;
  onFilter: (value: string) => void;
  collapse: CollapseState;
  /** Every collection in the list, to collapse all of their groups. */
  nsids: string[];
  /** A total shown beside the filter, e.g. the number of records. */
  summary?: string;
}) => {
  let inputRef: HTMLInputElement | undefined;
  onMount(() => useFilterShortcut(() => inputRef));

  const allCollapsed = () => props.collapse.allCollapsed(props.nsids);
  const label = () => (allCollapsed() ? "Expand all" : "Collapse all");

  return (
    <div class="bottom-controls-fade dark:bg-dark-500 fixed bottom-0 left-0 z-10 flex w-full justify-center bg-neutral-100 px-3 pt-3 pb-6">
      <div class="flex w-full max-w-[40.5rem] items-center gap-2">
        <FilterInput
          class="grow"
          inputRef={(input) => (inputRef = input)}
          name="filter"
          placeholder="Filter collections..."
          value={props.filter}
          onInput={props.onFilter}
        />
        <Show when={props.summary}>
          <span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
            {props.summary}
          </span>
        </Show>
        <Tooltip text={label()}>
          <button
            type="button"
            aria-label={label()}
            onClick={() =>
              allCollapsed() ? props.collapse.expandAll() : props.collapse.collapseAll(props.nsids)
            }
            class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 flex size-8.5 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-700 transition-colors select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300"
          >
            <span
              class={`iconify ${allCollapsed() ? "lucide--chevrons-up-down" : "lucide--chevrons-down-up"}`}
            />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
