import * as TID from "@atcute/tid";
import { A, type RouteSectionProps, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

import { Button } from "../../components/button.jsx";
import HoverCard from "../../components/hover-card/base.jsx";
import { JSONValue } from "../../components/json.jsx";
import { NestedLayout } from "../../components/nested-layout.jsx";
import { TextInput } from "../../components/text-input.jsx";
import { listSpaceRecords, type SpaceRecord } from "../../lib/spaces.js";
import { localDateFromTimestamp } from "../../utils/date.js";
import { makeSpaceRecordPath, makeSpaceRef, useSpacesAuth } from "./context.jsx";
import { EmptyState, ErrorNotice, LoadingState } from "./shared.jsx";

const RECORDS_PER_PAGE = 100;

const SpaceCollectionView = () => {
  const auth = useSpacesAuth();
  const params = useParams();
  const hidden = () => !!params.rkey;
  const [records, setRecords] = createSignal<SpaceRecord[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [filter, setFilter] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let activeKey = "";
  let requestVersion = 0;

  const space = () => makeSpaceRef(params.spaceAuthority!, params.spaceType!, params.skey!);

  const filteredRecords = createMemo(() => {
    const value = filter().trim().toLowerCase();
    if (!value) return records();
    return records().filter((record) => {
      const recordValue = record.value === undefined ? "" : JSON.stringify(record.value);
      return `${record.rkey}\n${record.cid}\n${recordValue}`.toLowerCase().includes(value);
    });
  });

  const loadRecords = async (reset = false, version = requestVersion) => {
    if (loading() && !reset) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await listSpaceRecords(auth(), space(), auth().sub, {
        collection: params.collection,
        cursor: reset ? undefined : cursor(),
        limit: RECORDS_PER_PAGE,
      });
      if (version !== requestVersion) return;
      setRecords((current) => (reset ? result.records : [...current, ...result.records]));
      setCursor(result.cursor);
      setLoaded(true);
    } catch (err) {
      if (version !== requestVersion) return;
      setError(err instanceof Error ? err.message : "Could not load Space records");
      setLoaded(true);
    } finally {
      if (version === requestVersion) setLoading(false);
    }
  };

  createEffect(() => {
    const key = `${auth().sub}\n${space()}\n${params.collection}`;
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
        <div class="flex items-center justify-between gap-3 px-2 text-sm">
          <span class="text-neutral-600 dark:text-neutral-400">
            <Show when={filter().trim()}>
              {filteredRecords().length.toLocaleString()} matching record
              {filteredRecords().length === 1 ? "" : "s"}
              <span class="text-neutral-400 dark:text-neutral-600"> · </span>
            </Show>
            {records().length.toLocaleString()} {cursor() ? "loaded " : ""}record
            {records().length === 1 ? "" : "s"}
          </span>
          <A
            href={`/lexicon/${params.collection}`}
            target="_blank"
            class="shrink-0 text-blue-500 hover:underline dark:text-blue-400"
          >
            View schema
          </A>
        </div>

        <div class="px-2">
          <TextInput
            placeholder="Filter records"
            value={filter()}
            onInput={(event) => setFilter(event.currentTarget.value)}
            class="w-full text-sm"
          />
        </div>

        <Show when={loading() && !loaded()}>
          <LoadingState label="Loading records…" />
        </Show>

        <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

        <Show when={loaded() && (!error() || records().length > 0)}>
          <div class="flex flex-col px-1 font-mono">
            <For each={filteredRecords()}>
              {(record) => {
                const timestamp = () =>
                  TID.validate(record.rkey) ? TID.parse(record.rkey).timestamp / 1000 : undefined;

                return (
                  <HoverCard
                    class="flex w-full min-w-0 items-baseline rounded hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                    activeClass="bg-neutral-200 dark:bg-neutral-800"
                    previewPlacement="side"
                    trigger={
                      <A
                        href={makeSpaceRecordPath(
                          params.spaceAuthority!,
                          params.spaceType!,
                          params.skey!,
                          params.collection!,
                          record.rkey,
                        )}
                        class="flex w-full min-w-0 items-baseline gap-1 px-1 py-0.5"
                      >
                        <span class="max-w-full shrink-0 truncate text-sm text-blue-500 dark:text-blue-400">
                          {record.rkey}
                        </span>
                        <span
                          class="min-w-0 truncate text-xs text-neutral-400 dark:text-neutral-500"
                          dir="rtl"
                        >
                          {record.cid}
                        </span>
                        <Show when={timestamp()}>
                          {(value) => (
                            <span class="ml-auto shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                              {localDateFromTimestamp(value())}
                            </span>
                          )}
                        </Show>
                      </A>
                    }
                  >
                    <Show
                      when={record.value !== undefined}
                      fallback={
                        <span class="text-sm text-neutral-500 dark:text-neutral-400">
                          No value returned
                        </span>
                      }
                    >
                      <JSONValue
                        data={record.value!}
                        repo={auth().sub}
                        truncate
                        hideBlobs
                        preview
                      />
                    </Show>
                  </HoverCard>
                );
              }}
            </For>
          </div>

          <Show when={filteredRecords().length === 0}>
            <EmptyState
              icon={filter() ? "lucide--search-x" : "lucide--file-json"}
              message={filter() ? "No records match your filter" : "No records found"}
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

export const SpaceCollectionLayout = (props: RouteSectionProps) => {
  const params = useParams();
  const hasChild = () => !!params.rkey;
  const key = () =>
    `${params.spaceAuthority}/${params.spaceType}/${params.skey}/${params.collection}`;

  return (
    <NestedLayout key={key()} hasChild={hasChild()} view={() => <SpaceCollectionView />}>
      {props.children}
    </NestedLayout>
  );
};
