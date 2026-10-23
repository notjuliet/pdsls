import { A } from "@solidjs/router";
import { createMemo, createSignal, For, type JSX, onMount, Show } from "solid-js";

import { useFilterShortcut } from "../../lib/keyboard.js";
import { DomainGroup, DomainGroupRows, domainGroupRowClasses } from "../ui/domain-group.jsx";
import { FilterInput } from "../ui/filter-input.jsx";

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

/** The fixed panel under a collection list: the filter (focused with "/") and expand/collapse all. */
export const CollectionListControls = (props: {
  filter: string;
  onFilter: (value: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) => {
  let inputRef: HTMLInputElement | undefined;
  onMount(() => useFilterShortcut(() => inputRef));

  const buttonClass =
    "rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 active:bg-neutral-300 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 dark:active:bg-neutral-600";

  return (
    <div class="bottom-controls-fade dark:bg-dark-500 fixed bottom-0 left-0 z-10 flex w-full flex-col items-center gap-2 bg-neutral-100 px-3 pt-3 pb-6">
      <FilterInput
        class="w-full max-w-[34.5rem]"
        inputRef={(input) => (inputRef = input)}
        name="filter"
        placeholder="Filter collections..."
        value={props.filter}
        onInput={props.onFilter}
      />
      <div class="flex w-full max-w-[34.5rem] justify-end gap-1">
        <button type="button" class={buttonClass} onClick={() => props.onExpandAll()}>
          Expand all
        </button>
        <button type="button" class={buttonClass} onClick={() => props.onCollapseAll()}>
          Collapse all
        </button>
      </div>
    </div>
  );
};
