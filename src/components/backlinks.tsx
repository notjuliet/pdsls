import * as TID from "@atcute/tid";
import { A, useLocation } from "@solidjs/router";
import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { getAllBacklinks, getRecordBacklinks, LinksWithRecords } from "../lib/api.js";
import { localDateFromTimestamp } from "../utils/date.js";
import { Button } from "./button.jsx";
import { Favicon } from "./favicon.jsx";
import DidHoverCard from "./hover-card/did.jsx";
import RecordHoverCard from "./hover-card/record.jsx";

type BacklinksProps = {
  target: string;
  collection: string;
  path: string;
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

const BacklinkRecords = (props: BacklinksProps & { cursor?: string }) => {
  const [links, setLinks] = createSignal<LinksWithRecords>();
  const [more, setMore] = createSignal(false);

  onMount(async () => {
    const res = await getRecordBacklinks(props.target, props.collection, props.path, props.cursor);
    setLinks(res);
  });

  return (
    <Show when={links()} fallback={<p class="px-3 py-2 text-center text-neutral-500">Loading…</p>}>
      <For each={links()!.linking_records}>
        {({ did, collection, rkey }) => {
          const timestamp =
            TID.validate(rkey) ? localDateFromTimestamp(TID.parse(rkey).timestamp / 1000) : null;
          const uri = `at://${did}/${collection}/${rkey}`;
          return (
            <RecordHoverCard
              uri={uri}
              class="block"
              trigger={
                <a
                  href={`/${uri}`}
                  class="grid grid-cols-[auto_1fr_auto] items-center gap-x-1 px-2 py-1.5 font-mono text-xs select-none hover:bg-neutral-200/50 sm:gap-x-3 sm:px-3 dark:hover:bg-neutral-700/50"
                >
                  <span class="text-blue-500 dark:text-blue-400">{rkey}</span>
                  <DidHoverCard
                    did={did}
                    class="min-w-0"
                    trigger={
                      <a
                        href={`/at://${did}`}
                        class="block truncate text-neutral-700 hover:underline dark:text-neutral-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {did}
                      </a>
                    }
                  />
                  <span class="text-neutral-500 tabular-nums dark:text-neutral-400">
                    {timestamp ?? ""}
                  </span>
                </a>
              }
            />
          );
        }}
      </For>
      <Show when={links()?.cursor}>
        <Show
          when={more()}
          fallback={
            <div class="p-2">
              <Button
                onClick={() => setMore(true)}
                class="dark:hover:bg-dark-200 dark:active:bg-dark-100 w-full rounded-md border-[0.5px] border-neutral-300 bg-neutral-50 px-2 py-1.5 text-sm select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800"
              >
                Load more
              </Button>
            </div>
          }
        >
          <BacklinkRecords
            target={props.target}
            collection={props.collection}
            path={props.path}
            cursor={links()!.cursor}
          />
        </Show>
      </Show>
    </Show>
  );
};

const BacklinkDirectory = (props: { groups: CollectionGroup[]; pathname: string }) => {
  return (
    <div class="flex w-full flex-col gap-1.5">
      <Show when={props.groups.length === 0}>
        <p class="text-neutral-500">No backlinks found.</p>
      </Show>
      <For each={props.groups}>
        {(group) => {
          const authority = () => group.collection.split(".").slice(0, 2).join(".");
          return (
            <A
              href={`${props.pathname}#backlinks:${group.collection}`}
              class="flex items-center justify-between gap-3 rounded-lg border border-neutral-300 px-3 py-2 text-left hover:bg-neutral-200/50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <Favicon domain={authority()} reverse />
                <span class="min-w-0 truncate">{group.collection}</span>
              </div>
              <div class="flex shrink-0 items-center gap-2 text-neutral-600 dark:text-neutral-400">
                <span class="text-xs">
                  {group.totalRecords} record{group.totalRecords !== 1 ? "s" : ""}
                </span>
                <span class="iconify lucide--chevron-right" />
              </div>
            </A>
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
}) => {
  const authority = () => props.collection.split(".").slice(0, 2).join(".");

  return (
    <div class="flex w-full flex-col gap-3">
      <div class="flex items-center gap-1">
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
      <For each={props.entries}>
        {(entry) => (
          <div class="overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
            <div class="flex items-center justify-between gap-3 border-b border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
              <span class="min-w-0 truncate text-neutral-700 dark:text-neutral-300">
                {entry.path.slice(1)}
              </span>
              <span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                {entry.counts.records} from {entry.counts.distinct_dids} repo
                {entry.counts.distinct_dids > 1 ? "s" : ""}
              </span>
            </div>
            <div class="bg-neutral-50/50 dark:bg-neutral-800/30">
              <BacklinkRecords
                target={props.target}
                collection={entry.collection}
                path={entry.path}
              />
            </div>
          </div>
        )}
      </For>
    </div>
  );
};

const Backlinks = (props: { target: string }) => {
  const location = useLocation();

  const [response] = createResource(async () => {
    const res = await getAllBacklinks(props.target);
    return flattenLinks(res.links);
  });

  const groups = () => (response() ? groupByCollection(response()!) : []);

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
    <div class="flex w-full flex-col gap-3 text-sm">
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
            />
          </Show>
        </Show>
      </Show>
    </div>
  );
};

export { Backlinks };
