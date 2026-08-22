import { A, type RouteSectionProps, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

import { Button } from "../../components/button.jsx";
import { Favicon } from "../../components/favicon.jsx";
import { NestedLayout } from "../../components/nested-layout.jsx";
import { TextInput } from "../../components/text-input.jsx";
import { listSpaceRecords, type SpaceRecord } from "../../lib/spaces.js";
import { makeSpaceCollectionPath, makeSpaceRef, useSpacesAuth } from "./context.jsx";
import { EmptyState, ErrorNotice, LoadingState } from "./shared.jsx";

const SpaceRepoView = () => {
  const auth = useSpacesAuth();
  const params = useParams();
  const hidden = () => !!params.collection;
  const repo = () => params.spaceRepo!;
  const [records, setRecords] = createSignal<SpaceRecord[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [filter, setFilter] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let activeKey = "";
  let requestVersion = 0;

  const space = () => makeSpaceRef(params.spaceAuthority!, params.spaceType!, params.skey!);

  const collections = createMemo(() => {
    const grouped = new Map<string, number>();
    for (const record of records()) {
      grouped.set(record.collection, (grouped.get(record.collection) ?? 0) + 1);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  const filteredCollections = createMemo(() => {
    const value = filter().trim().toLowerCase();
    if (!value) return collections();
    return collections().filter(([collection]) => collection.toLowerCase().includes(value));
  });

  const loadRecords = async (reset = false, version = requestVersion) => {
    if (loading() && !reset) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await listSpaceRecords(auth(), space(), repo(), {
        cursor: reset ? undefined : cursor(),
        excludeValues: true,
        limit: 1000,
      });
      if (version !== requestVersion) return;
      setRecords((current) => (reset ? result.records : [...current, ...result.records]));
      setCursor(result.cursor);
      setLoaded(true);
    } catch (err) {
      if (version !== requestVersion) return;
      setError(err instanceof Error ? err.message : "Could not load Space collections");
      setLoaded(true);
    } finally {
      if (version === requestVersion) setLoading(false);
    }
  };

  createEffect(() => {
    const key = `${auth().sub}\n${space()}\n${repo()}`;
    if (key !== activeKey) {
      activeKey = key;
      requestVersion += 1;
      setRecords([]);
      setCursor(undefined);
      setFilter("");
      setLoaded(false);
      setLoading(false);
      setError(undefined);
    }
    if (!hidden() && !loaded() && !loading()) void loadRecords(true, requestVersion);
  });

  return (
    <Show when={!hidden()}>
      <div class="flex w-full flex-col gap-3 py-2 pb-10">
        <Show when={loading() && !loaded()}>
          <LoadingState label="Loading collections…" />
        </Show>

        <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

        <Show when={loaded() && (!error() || records().length > 0)}>
          <div class="px-2 text-sm text-neutral-600 dark:text-neutral-400">
            {collections().length.toLocaleString()}
            {cursor() ? "+" : ""} collection{collections().length === 1 ? "" : "s"}
            <span class="text-neutral-400 dark:text-neutral-600"> · </span>
            {records().length.toLocaleString()} {cursor() ? "loaded " : ""}record
            {records().length === 1 ? "" : "s"}
          </div>

          <div class="px-2">
            <TextInput
              placeholder="Filter collections"
              value={filter()}
              onInput={(event) => setFilter(event.currentTarget.value)}
              class="w-full text-sm"
            />
          </div>

          <ul class="flex flex-col">
            <For each={filteredCollections()}>
              {([collection, count]) => {
                const authority = () => collection.split(".").slice(0, 2).join(".");
                return (
                  <li>
                    <A
                      href={makeSpaceCollectionPath(
                        params.spaceAuthority!,
                        params.spaceType!,
                        params.skey!,
                        repo(),
                        collection,
                      )}
                      class="flex w-full items-center gap-2 rounded p-2 text-left text-sm hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                    >
                      <Favicon domain={authority()} reverse />
                      <span class="min-w-0 truncate font-medium text-blue-500 dark:text-blue-400">
                        {collection}
                      </span>
                      <span class="ml-auto shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                        {count.toLocaleString()}
                        {cursor() ? "+" : ""}
                      </span>
                    </A>
                  </li>
                );
              }}
            </For>
          </ul>

          <Show when={filteredCollections().length === 0}>
            <EmptyState
              icon={filter() ? "lucide--search-x" : "lucide--folder-open"}
              message={filter() ? "No collections match your filter" : "No collections found"}
            />
          </Show>

          <Show when={cursor()}>
            <Button
              onClick={() => void loadRecords()}
              disabled={loading()}
              classList={{ "w-fit self-center": true }}
            >
              <Show when={loading()} fallback={<span class="iconify lucide--chevrons-down" />}>
                <span class="iconify lucide--loader-circle animate-spin" />
              </Show>
              Load more records
            </Button>
          </Show>
        </Show>
      </div>
    </Show>
  );
};

export const SpaceRepoLayout = (props: RouteSectionProps) => {
  const params = useParams();
  const hasChild = () => !!params.collection;
  const key = () =>
    `${params.spaceAuthority}/${params.spaceType}/${params.skey}/${params.spaceRepo}`;

  return (
    <NestedLayout key={key()} hasChild={hasChild()} view={() => <SpaceRepoView />}>
      {props.children}
    </NestedLayout>
  );
};
