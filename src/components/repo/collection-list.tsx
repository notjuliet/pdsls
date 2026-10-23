import { A } from "@solidjs/router";
import { createMemo, createSignal, For, type JSX, Show } from "solid-js";

import { DomainGroup, DomainGroupRows, domainGroupRowClasses } from "../ui/domain-group.jsx";

export interface CollectionItem {
  nsid: string;
  /** Record count, shown on the right when known. */
  count?: number | string;
  href: string;
}

interface CollectionListProps {
  collections: CollectionItem[];
  filter?: string;
  /** Controls which authorities are collapsed; when omitted the list keeps its own state. */
  collapsed?: (authority: string) => boolean;
  onToggle?: (authority: string) => void;
  /** Shown when no collection matches. */
  fallback?: JSX.Element;
}

const nsidAuthority = (nsid: string) => nsid.split(".").slice(0, 2).join(".");

export const displayNsidDomain = (authority: string) => authority.split(".").reverse().join(".");

export const CollectionList = (props: CollectionListProps) => {
  const [collapsedAuthorities, setCollapsedAuthorities] = createSignal(new Set<string>());

  const isCollapsed = (authority: string) =>
    props.collapsed ? props.collapsed(authority) : collapsedAuthorities().has(authority);

  const toggle = (authority: string) => {
    if (props.onToggle) return props.onToggle(authority);
    setCollapsedAuthorities((current) => {
      const next = new Set(current);
      if (next.has(authority)) next.delete(authority);
      else next.add(authority);
      return next;
    });
  };

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
              collapsed={isCollapsed(group.authority)}
              collapsedLabel={
                <>
                  {group.items.length} {group.items.length === 1 ? "collection" : "collections"}
                </>
              }
              onToggle={() => toggle(group.authority)}
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
