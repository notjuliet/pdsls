import { A, useLocation } from "@solidjs/router";
import { createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { getAllBacklinks, getRecordBacklinks, LinksWithRecords } from "../../lib/api.js";
import { localDateFromTimestamp, relativeTimeFromTimestamp } from "../../lib/format.js";
import { LoadMoreSentinel } from "../../lib/infinite-scroll.jsx";
import { useRepo } from "../../lib/repo-context.jsx";
import DidHoverCard from "../hover-card/did.jsx";
import RecordHoverCard from "../hover-card/record.jsx";
import { DomainGroup, DomainGroupRows, domainGroupRowClasses } from "../ui/domain-group.jsx";
import { Favicon } from "../ui/favicon.jsx";
import { HEADING_TEXT_CLASS } from "../ui/info.jsx";
import Tooltip from "../ui/tooltip.jsx";
import { timestampFromRkey } from "./record-row.jsx";

type BacklinksProps = {
  target: string;
  collection: string;
  path: string;
  repoDid: string;
};

type BacklinkEntry = {
  collection: string;
  path: string;
  counts: { distinct_dids: number; records: number };
};

type CollectionGroup = {
  collection: string;
  entries: BacklinkEntry[];
  totalRecords: number;
};

type BacklinkDomainGroup = {
  authority: string;
  domain: string;
  collections: CollectionGroup[];
  totalRecords: number;
};

const collectionAuthority = (collection: string) => collection.split(".").slice(0, 2).join(".");
const displayDomain = (authority: string) => authority.split(".").reverse().join(".");

const flattenLinks = (links: Record<string, any>): BacklinkEntry[] => {
  const entries: BacklinkEntry[] = [];
  Object.keys(links)
    .toSorted()
    .forEach((collection) => {
      const paths = links[collection];
      Object.keys(paths)
        .toSorted()
        .forEach((path) => {
          if (paths[path].records > 0) {
            entries.push({ collection, path, counts: paths[path] });
          }
        });
    });
  return entries;
};

const groupByCollection = (entries: BacklinkEntry[]): CollectionGroup[] => {
  const map = new Map<string, BacklinkEntry[]>();
  for (const entry of entries) {
    const existing = map.get(entry.collection);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(entry.collection, [entry]);
    }
  }
  return Array.from(map.entries()).map(([collection, entries]) => ({
    collection,
    entries,
    totalRecords: entries.reduce((sum, e) => sum + e.counts.records, 0),
  }));
};

const groupByDomain = (entries: BacklinkEntry[]): BacklinkDomainGroup[] => {
  const map = new Map<string, CollectionGroup[]>();

  for (const collection of groupByCollection(entries)) {
    const authority = collectionAuthority(collection.collection);
    const existing = map.get(authority);
    if (existing) existing.push(collection);
    else map.set(authority, [collection]);
  }

  return Array.from(map, ([authority, collections]) => ({
    authority,
    domain: displayDomain(authority),
    collections,
    totalRecords: collections.reduce((sum, collection) => sum + collection.totalRecords, 0),
  })).sort((a, b) => a.domain.localeCompare(b.domain));
};

const BacklinkRecords = (
  props: BacklinksProps & {
    cursor?: string;
    /** A first page already fetched, so the list shows it without loading again. */
    initial?: LinksWithRecords;
  },
) => {
  const [links, setLinks] = createSignal<LinksWithRecords | undefined>(props.initial);
  const [more, setMore] = createSignal(false);

  onMount(async () => {
    if (props.initial) return;
    const res = await getRecordBacklinks(props.target, props.collection, props.path, props.cursor);
    setLinks(res);
  });

  return (
    <Show
      when={links()}
      fallback={
        <p class="motion-safe:animate-fade-in-late px-2 py-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          Loading…
        </p>
      }
    >
      <div class="motion-safe:animate-fade-in flex flex-col">
        <For each={links()!.linking_records}>
          {({ did, collection, rkey }) => {
            const uri = `at://${did}/${collection}/${rkey}`;
            const rkeyIsRepo = rkey === props.repoDid;
            const timestamp = rkeyIsRepo ? undefined : timestampFromRkey(rkey);
            return (
              <RecordHoverCard
                uri={uri}
                class="block min-w-0"
                renderTrigger={(state) => (
                  // The whole row opens the record. The DID isn't a link of its own, so links
                  // don't nest, but it still previews its handle on hover.
                  <A
                    href={`/${uri}`}
                    class="dark:hover:bg-dark-200 dark:active:bg-dark-100 flex min-w-0 items-baseline gap-x-3 rounded-md px-2 py-1.5 font-mono text-xs select-none hover:bg-neutral-200/50 active:bg-neutral-200"
                  >
                    <span
                      class="text-blue-500 dark:text-blue-400"
                      classList={{
                        "min-w-0 truncate": rkeyIsRepo,
                        "shrink-0": !rkeyIsRepo,
                        "hover-card-trigger-loading": state.loading(),
                      }}
                    >
                      {rkey}
                    </span>
                    <DidHoverCard
                      did={did}
                      class="min-w-0 flex-1"
                      renderTrigger={(didState) => (
                        <span
                          class="block truncate text-neutral-700 dark:text-neutral-300"
                          classList={{ "hover-card-trigger-loading": didState.loading() }}
                        >
                          {did}
                        </span>
                      )}
                    />
                    <Show when={timestamp}>
                      {(time) => (
                        <Tooltip alignEnd text={localDateFromTimestamp(time())}>
                          <span class="shrink-0 font-sans text-neutral-500 dark:text-neutral-400">
                            {relativeTimeFromTimestamp(time())}
                          </span>
                        </Tooltip>
                      )}
                    </Show>
                  </A>
                )}
              />
            );
          }}
        </For>
      </div>
      <Show when={links()?.cursor}>
        <Show
          when={more()}
          fallback={
            <div>
              <button
                type="button"
                onClick={() => setMore(true)}
                class="dark:hover:bg-dark-200 dark:active:bg-dark-100 rounded-md px-2 py-1.5 text-xs text-blue-500 select-none hover:bg-neutral-200/50 active:bg-neutral-200 dark:text-blue-400"
              >
                Show more
              </button>
              <LoadMoreSentinel
                hasMore={() => !more() && !!links()?.cursor}
                loading={() => false}
                onLoadMore={() => setMore(true)}
              />
            </div>
          }
        >
          <BacklinkRecords
            target={props.target}
            collection={props.collection}
            path={props.path}
            repoDid={props.repoDid}
            cursor={links()!.cursor}
          />
        </Show>
      </Show>
    </Show>
  );
};

const BacklinkDirectory = (props: { groups: BacklinkDomainGroup[]; pathname: string }) => {
  const [collapsedDomains, setCollapsedDomains] = createSignal<Set<string>>(new Set());

  const toggleDomain = (authority: string) => {
    setCollapsedDomains((current) => {
      const next = new Set(current);
      if (next.has(authority)) next.delete(authority);
      else next.add(authority);
      return next;
    });
  };

  return (
    <div class="flex w-full flex-col gap-2 sm:gap-0">
      <Show when={props.groups.length === 0}>
        <p class="text-center text-neutral-500 dark:text-neutral-400">No backlinks found.</p>
      </Show>
      <For each={props.groups}>
        {(group) => {
          const isCollapsed = () => collapsedDomains().has(group.authority);

          return (
            <DomainGroup
              domain={group.domain}
              domainTitle={`${group.domain} (${group.authority})`}
              groupLabel="backlink collections"
              sticky
              collapsed={isCollapsed()}
              collapsedLabel={
                <>
                  {group.collections.length}{" "}
                  {group.collections.length === 1 ? "collection" : "collections"}
                  <span class="ml-1 text-neutral-400 dark:text-neutral-500">
                    · {group.totalRecords} {group.totalRecords === 1 ? "record" : "records"}
                  </span>
                </>
              }
              onToggle={() => toggleDomain(group.authority)}
            >
              <DomainGroupRows>
                <For each={group.collections}>
                  {(collection) => {
                    const label = collection.collection.split(".").slice(2).join(".");
                    const recordCountLabel = `${collection.totalRecords} ${
                      collection.totalRecords === 1 ? "record" : "records"
                    }`;
                    return (
                      <A
                        href={`${props.pathname}#backlinks:${collection.collection}`}
                        class={`group/collection flex min-w-0 items-center justify-between gap-3 active:underline ${domainGroupRowClasses}`}
                        title={collection.collection}
                        aria-label={`${collection.collection}, ${recordCountLabel}`}
                      >
                        <span class="min-w-0 truncate group-hover/collection:underline">
                          <Show when={label}>
                            <span class="text-neutral-500 dark:text-neutral-400">
                              {group.authority}.
                            </span>
                          </Show>
                          {label || collection.collection}
                        </span>
                        <span
                          class="shrink-0 text-xs text-neutral-500 tabular-nums dark:text-neutral-400"
                          title={recordCountLabel}
                        >
                          {collection.totalRecords}
                        </span>
                      </A>
                    );
                  }}
                </For>
              </DomainGroupRows>
            </DomainGroup>
          );
        }}
      </For>
    </div>
  );
};

const BacklinkCollectionDetail = (props: {
  target: string;
  collection: string;
  entries: BacklinkEntry[];
  pathname: string;
  repoDid: string;
}) => {
  const authority = () => collectionAuthority(props.collection);
  // Every group's first page loads together, so the groups appear at once instead of their
  // headings showing first and each list pushing the ones below it down as it arrives.
  const [firstPages] = createResource(
    () => props.entries,
    (entries) =>
      Promise.all(
        entries.map((entry) => getRecordBacklinks(props.target, entry.collection, entry.path)),
      ),
  );

  // The title stays at the top while the lists scroll, like the labels page's controls, and the
  // heading of the group being scrolled through sticks just under it.
  const [isSticky, setIsSticky] = createSignal(false);
  const [titleHeight, setTitleHeight] = createSignal(0);
  const [stuckGroup, setStuckGroup] = createSignal(-1);
  let stickySentinel!: HTMLDivElement;
  let title!: HTMLDivElement;
  const headings: HTMLDivElement[] = [];

  // The stuck heading is the one sitting right under the title while its group's rows still
  // run below it; it takes the fade over from the title, which would otherwise dim it.
  const findStuckGroup = () => {
    const top = title.offsetHeight;
    setTitleHeight(top);
    let stuck = -1;
    headings.forEach((heading, index) => {
      const rect = heading.getBoundingClientRect();
      const group = heading.parentElement!.getBoundingClientRect();
      if (group.top < top && rect.top <= top + 0.5 && group.bottom > top + rect.height + 1) {
        stuck = index;
      }
    });
    setStuckGroup(stuck);
  };

  onMount(() => {
    const observer = new IntersectionObserver(([entry]) => setIsSticky(!entry.isIntersecting));
    observer.observe(stickySentinel);
    window.addEventListener("scroll", findStuckGroup, { passive: true });
    window.addEventListener("resize", findStuckGroup, { passive: true });
    findStuckGroup();
    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("scroll", findStuckGroup);
      window.removeEventListener("resize", findStuckGroup);
    });
  });

  return (
    <div class="flex w-full flex-col gap-2">
      <div ref={stickySentinel} class="-mb-[calc(0.5rem+1px)] h-px w-full" aria-hidden="true" />
      <div
        ref={title}
        class="dark:bg-dark-500 sticky top-0 z-10 flex items-center gap-1 bg-neutral-100"
        classList={{ "top-controls-fade": isSticky() && stuckGroup() < 0 }}
      >
        <A
          href={`${props.pathname}#backlinks`}
          class="-ml-2 flex items-center rounded-md p-2 text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700/50"
        >
          <span class="iconify lucide--arrow-left" />
        </A>
        <div class="flex items-center gap-2">
          <Favicon domain={authority()} reverse />
          <span class="font-medium">{props.collection}</span>
        </div>
      </div>
      <Show
        when={firstPages()}
        fallback={
          <p class="motion-safe:animate-fade-in-late text-sm text-neutral-500 dark:text-neutral-400">
            Loading…
          </p>
        }
      >
        <div class="flex flex-col gap-3">
          <For each={props.entries}>
            {(entry, index) => (
              <section class="motion-safe:animate-fade-in flex flex-col gap-1 border-t border-neutral-200 pt-2 first:border-t-0 first:pt-0 dark:border-neutral-700/60">
                {/* Groups are divided like the backlinks index's domains. The count sits by the path,
                  not over the right-hand column the rows' times use. */}
                <div
                  ref={(el) => (headings[index()] = el)}
                  class="dark:bg-dark-500 sticky z-9 flex min-w-0 items-baseline gap-2 bg-neutral-100 py-1 text-sm"
                  classList={{ "top-controls-fade": stuckGroup() === index() }}
                  style={{ top: `${titleHeight()}px` }}
                >
                  <h3 class={`min-w-0 truncate ${HEADING_TEXT_CLASS}`}>{entry.path.slice(1)}</h3>
                  <span class="shrink-0 text-neutral-500 dark:text-neutral-400">
                    {entry.counts.records.toLocaleString()} from{" "}
                    {entry.counts.distinct_dids.toLocaleString()} repo
                    {entry.counts.distinct_dids > 1 ? "s" : ""}
                  </span>
                </div>
                {/* Pulled out by the rows' padding, so their text lines up with the heading. */}
                <div class="-mx-2 flex flex-col">
                  <BacklinkRecords
                    target={props.target}
                    collection={entry.collection}
                    path={entry.path}
                    repoDid={props.repoDid}
                    initial={firstPages()![index()]}
                  />
                </div>
              </section>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

const Backlinks = (props: { target: string }) => {
  const repo = useRepo();
  const location = useLocation();

  const [response] = createResource(async () => {
    const res = await getAllBacklinks(props.target);
    return flattenLinks(res.links);
  });

  const groups = () => (response() ? groupByDomain(response()!) : []);

  const selectedCollection = () => {
    const hash = location.hash;
    if (hash.startsWith("#backlinks:")) {
      return hash.slice("#backlinks:".length);
    }
    return null;
  };

  const selectedEntries = () => {
    const col = selectedCollection();
    if (!col || !response()) return [];
    return response()!.filter((e) => e.collection === col);
  };

  return (
    <div class="flex w-full flex-col gap-4 text-sm">
      <Show when={!response.error} fallback={<p class="text-red-500">Failed to load backlinks.</p>}>
        <Show when={response()} fallback={<p class="text-neutral-500">Loading…</p>}>
          <Show
            when={selectedCollection()}
            fallback={<BacklinkDirectory groups={groups()} pathname={location.pathname} />}
          >
            <BacklinkCollectionDetail
              target={props.target}
              collection={selectedCollection()!}
              entries={selectedEntries()}
              pathname={location.pathname}
              repoDid={repo.did()}
            />
          </Show>
        </Show>
        <p class="text-center text-xs text-neutral-400 dark:text-neutral-500">
          data from{" "}
          <a
            href="https://www.microcosm.blue/"
            target="_blank"
            class="hover:text-neutral-600 hover:underline dark:hover:text-neutral-300"
          >
            microcosm
          </a>
        </p>
      </Show>
    </div>
  );
};

export { Backlinks };
