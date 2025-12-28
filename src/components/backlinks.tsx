import * as TID from "@atcute/tid";
import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { getAllBacklinks, getRecordBacklinks, LinksWithRecords } from "../utils/api.js";
import { localDateFromTimestamp } from "../utils/date.js";
import { Button } from "./button.jsx";

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

const BacklinkRecords = (props: BacklinksProps & { cursor?: string }) => {
  const [links, setLinks] = createSignal<LinksWithRecords>();
  const [more, setMore] = createSignal(false);

  onMount(async () => {
    const res = await getRecordBacklinks(props.target, props.collection, props.path, props.cursor);
    setLinks(res);
  });

  return (
    <Show when={links()} fallback={<p class="px-3 py-2 text-neutral-500">Loading…</p>}>
      <For each={links()!.linking_records}>
        {({ did, collection, rkey }) => {
          const timestamp =
            TID.validate(rkey) ? localDateFromTimestamp(TID.parse(rkey).timestamp / 1000) : null;
          return (
            <a
              href={`/at://${did}/${collection}/${rkey}`}
              class="grid grid-cols-[auto_1fr_auto] items-center gap-x-1 px-2 py-1.5 font-mono text-xs select-none hover:bg-neutral-200/50 active:bg-neutral-200/50 sm:gap-x-3 sm:px-3 dark:hover:bg-neutral-700/50 dark:active:bg-neutral-700/50"
            >
              <span class="text-blue-500 dark:text-blue-400">{rkey}</span>
              <span class="truncate text-neutral-700 dark:text-neutral-300" title={did}>
                {did}
              </span>
              <span class="text-neutral-500 tabular-nums dark:text-neutral-400">
                {timestamp ?? ""}
              </span>
            </a>
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
                class="dark:hover:bg-dark-200 dark:shadow-dark-700 dark:active:bg-dark-100 box-border flex h-7 w-full items-center justify-center gap-1 rounded border-[0.5px] border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs shadow-xs select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800"
              >
                Load More
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

const Backlinks = (props: { target: string }) => {
  const [response] = createResource(async () => {
    const res = await getAllBacklinks(props.target);
    return flattenLinks(res.links);
  });

  return (
    <div class="flex w-full flex-col gap-3 text-sm">
      <Show when={response()} fallback={<p class="text-neutral-500">Loading…</p>}>
        <Show when={response()!.length === 0}>
          <p class="text-neutral-500">No backlinks found.</p>
        </Show>
        <For each={response()}>
          {(entry) => (
            <BacklinkSection
              target={props.target}
              collection={entry.collection}
              path={entry.path}
              counts={entry.counts}
            />
          )}
        </For>
      </Show>
    </div>
  );
};

const BacklinkSection = (
  props: BacklinksProps & { counts: { distinct_dids: number; records: number } },
) => {
  const [expanded, setExpanded] = createSignal(false);

  return (
    <div class="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
      <button
        class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
        onClick={() => setExpanded(!expanded())}
      >
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="w-full truncate">{props.collection}</span>
          <span class="w-full text-xs wrap-break-word text-neutral-500 dark:text-neutral-400">
            {props.path.slice(1)}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-2 text-neutral-700 dark:text-neutral-300">
          <span class="text-xs">
            {props.counts.records} from {props.counts.distinct_dids} repo
            {props.counts.distinct_dids > 1 ? "s" : ""}
          </span>
          <span
            class="iconify lucide--chevron-down transition-transform"
            classList={{ "rotate-180": expanded() }}
          />
        </div>
      </button>
      <Show when={expanded()}>
        <div class="border-t border-neutral-200 bg-neutral-50/50 dark:border-neutral-700 dark:bg-neutral-800/30">
          <BacklinkRecords target={props.target} collection={props.collection} path={props.path} />
        </div>
      </Show>
    </div>
  );
};

export { Backlinks };
