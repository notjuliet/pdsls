import { A, useSearchParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, type JSX, onMount, Show } from "solid-js";

import type { ScopeId } from "../auth/scope-utils";
import { createDebouncedValue } from "../lib/debounced.js";
import { LoadMoreSentinel } from "../lib/infinite-scroll.jsx";
import { useFilterShortcut } from "../lib/keyboard.js";
import { SchemaTabContent, useLexiconSchema } from "../lib/schema-tab.jsx";
import { Button } from "./button.jsx";
import { FilterInput } from "./filter-input.jsx";
import type { JSONType } from "./json.jsx";
import { Modal } from "./modal.jsx";
import { addNotification } from "./notification.jsx";
import { PermissionButton } from "./permission-button.jsx";
import {
  addPreviewFieldOptions,
  formatPreviewValue,
  getPathValue,
  PreviewFieldMenu,
} from "./preview-field.jsx";
import { RecordRow } from "./record-row.jsx";
import { EmptyState, ErrorNotice, LoadingState } from "./states.jsx";
import Tooltip from "./tooltip.jsx";

export interface CollectionRecord {
  rkey: string;
  cid: string;
  /** Undefined when the source listed the record without its value. */
  value: JSONType | undefined;
}

/** Where a collection's records come from: a PDS, a Space, or a CAR archive. */
export interface CollectionSource {
  /** The listing reloads from scratch whenever this changes. */
  key: string;
  repo: string;
  collection: string;
  collectionHref: string;
  recordHref: (rkey: string) => string;
  listRecords: (options: {
    cursor?: string;
    limit: number;
    reverse: boolean;
  }) => Promise<{ records: CollectionRecord[]; cursor?: string }>;
  /** Present when the viewer can delete records from this collection. */
  manage?: {
    scope: ScopeId;
    /** Present when records can also be deleted and recreated in place. */
    recreateScope?: ScopeId;
    deleteRecords: (records: CollectionRecord[], options: { recreate: boolean }) => Promise<void>;
  };
}

const PAGE_SIZE = 100;
const FILTER_DELAY = 150;

const getSearchParam = (param: string | string[] | undefined) =>
  Array.isArray(param) ? param[0] : (param ?? "");

const tabClass = (active: boolean) => ({
  "border-b-2 font-medium transition-colors": true,
  "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80": !active,
});

const iconButtonClass =
  "flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 disabled:opacity-40 dark:hover:bg-neutral-700 dark:active:bg-neutral-600";

export const CollectionPage = (props: {
  source: CollectionSource;
  /** Keeps the loaded records while a record of this collection is open. */
  hidden?: boolean;
  /** Extra tab links after Records and Schema. */
  tabs?: JSX.Element;
  /** Header actions shown outside manage mode, e.g. a create button. */
  actions?: JSX.Element;
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = createSignal<CollectionRecord[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [filter, setFilter] = createSignal("");
  const [visibleCount, setVisibleCount] = createSignal(PAGE_SIZE);
  const [managing, setManaging] = createSignal(false);
  const [selected, setSelected] = createSignal(new Set<string>());
  const [lastSelected, setLastSelected] = createSignal<number>();
  const [openDelete, setOpenDelete] = createSignal(false);
  const [recreate, setRecreate] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const lexicon = useLexiconSchema(() => (props.hidden ? undefined : props.source.collection));
  let filterInputRef: HTMLInputElement | undefined;
  let activeKey: string | undefined;
  let requestVersion = 0;

  onMount(() => useFilterShortcut(() => filterInputRef));

  const reverse = () => searchParams.reverse === "true";
  const previewField = () => getSearchParam(searchParams.preview);
  const limit = () => {
    const value = parseInt(getSearchParam(searchParams.limit));
    return value > 0 && value <= PAGE_SIZE ? value : PAGE_SIZE;
  };

  const stopManaging = () => {
    setManaging(false);
    setSelected(new Set<string>());
    setLastSelected(undefined);
  };

  const resetListing = () => {
    requestVersion += 1;
    setRecords([]);
    setCursor(undefined);
    setLoaded(false);
    setLoading(false);
    setError(undefined);
    setVisibleCount(PAGE_SIZE);
    stopManaging();
  };

  const loadRecords = async (reset: boolean) => {
    if (loading() && !reset) return;
    const version = requestVersion;

    setLoading(true);
    setError(undefined);
    try {
      const result = await props.source.listRecords({
        cursor: reset ? undefined : cursor(),
        limit: limit(),
        reverse: reverse(),
      });
      if (version !== requestVersion) return;
      setRecords((current) => (reset ? result.records : [...current, ...result.records]));
      // A page fetched on request is shown in full.
      if (!reset) setVisibleCount((count) => Math.max(count, records().length));
      setCursor(result.cursor);
    } catch (err) {
      if (version !== requestVersion) return;
      setError(err instanceof Error ? err.message : "Could not load records");
    } finally {
      if (version === requestVersion) {
        setLoaded(true);
        setLoading(false);
      }
    }
  };

  createEffect(() => {
    const key = `${props.source.key}\n${reverse()}\n${limit()}`;
    if (key !== activeKey) {
      activeKey = key;
      setFilter("");
      resetListing();
    }
    if (!props.hidden && !loaded() && !loading()) void loadRecords(true);
  });

  createEffect(() => {
    if (lexicon.showSchema()) {
      stopManaging();
      setOpenDelete(false);
    }
  });

  // Large collections (e.g. from a CAR) are expensive to scan, so the filter waits for
  // typing to pause and each record's search text is built once per load.
  const debouncedFilter = createDebouncedValue(filter, FILTER_DELAY);

  const searchIndex = createMemo(() =>
    records().map((record) => {
      const recordValue = record.value === undefined ? "" : JSON.stringify(record.value);
      return { record, text: `${record.rkey}\n${record.cid}\n${recordValue}`.toLowerCase() };
    }),
  );

  const filteredRecords = createMemo(() => {
    const value = debouncedFilter().trim().toLowerCase();
    if (!value) return records();
    return searchIndex()
      .filter((entry) => entry.text.includes(value))
      .map((entry) => entry.record);
  });

  const visibleRecords = () => filteredRecords().slice(0, visibleCount());
  const hasMore = () => visibleCount() < filteredRecords().length || (!!cursor() && !error());

  const loadMore = () => {
    if (visibleCount() < filteredRecords().length) setVisibleCount((count) => count + PAGE_SIZE);
    else if (cursor()) void loadRecords(false);
  };

  const previewFieldOptions = createMemo(() => {
    const fields = new Set<string>();
    for (const record of records()) {
      if (record.value !== undefined) addPreviewFieldOptions(record.value, fields);
    }
    return [...fields].sort((a, b) => a.localeCompare(b));
  });

  const preview = (record: CollectionRecord) => {
    const field = previewField();
    if (!field || record.value === undefined) return;
    const value = formatPreviewValue(getPathValue(record.value, field));
    return value === undefined ? undefined : { field, value };
  };

  const toggleRecord = (record: CollectionRecord, index: number, event: MouseEvent) => {
    const next = new Set(selected());
    if (event.shiftKey && lastSelected() !== undefined) {
      const start = Math.min(lastSelected()!, index);
      const end = Math.max(lastSelected()!, index);
      for (const item of filteredRecords().slice(start, end + 1)) next.add(item.rkey);
      if (selected().has(record.rkey)) next.delete(record.rkey);
    } else {
      setLastSelected(index);
      if (next.has(record.rkey)) next.delete(record.rkey);
      else next.add(record.rkey);
    }
    setSelected(next);
  };

  const selectAll = () => {
    setSelected(new Set(filteredRecords().map((record) => record.rkey)));
    setLastSelected(undefined);
  };

  const deleteRecords = async () => {
    const manage = props.source.manage;
    const targets = records().filter((record) => selected().has(record.rkey));
    if (!manage || deleting() || targets.length === 0) return;

    setDeleting(true);
    try {
      await manage.deleteRecords(targets, { recreate: recreate() });
      addNotification({
        message: `${targets.length} record${targets.length === 1 ? "" : "s"} ${recreate() ? "recreated" : "deleted"}`,
        type: "success",
        duration: 3000,
      });
    } catch (err) {
      addNotification({
        message: err instanceof Error ? err.message : "Could not delete the records",
        type: "error",
        duration: 5000,
      });
    } finally {
      setDeleting(false);
      setOpenDelete(false);
      setRecreate(false);
      resetListing();
    }
  };

  return (
    <Show when={!props.hidden}>
      <div class="flex w-full flex-col items-center">
        <div class="mb-2 flex min-h-7 w-full items-center justify-between px-2 text-sm sm:text-base">
          <div class="flex gap-3 sm:gap-4">
            <A href={props.source.collectionHref} classList={tabClass(!lexicon.showSchema())}>
              Records
            </A>
            <A
              href={`${props.source.collectionHref}#schema`}
              classList={tabClass(lexicon.showSchema())}
            >
              Schema
            </A>
            {props.tabs}
          </div>
          <Show when={!lexicon.showSchema()}>
            <div class="flex items-center text-sm sm:gap-1">
              <Show when={!managing()}>{props.actions}</Show>
              <Show when={props.source.manage}>
                {(manage) => (
                  <>
                    <Show when={managing()}>
                      <Tooltip text="Select all">
                        <button type="button" onClick={selectAll} class={iconButtonClass}>
                          <span class="iconify lucide--list-checks" />
                        </button>
                      </Tooltip>
                      <Show when={manage().recreateScope}>
                        {(scope) => (
                          <PermissionButton
                            scope={scope()}
                            tooltip="Recreate"
                            class={iconButtonClass}
                            disabledClass="flex items-center rounded-md p-1.5 opacity-40"
                            onClick={() => {
                              setRecreate(true);
                              setOpenDelete(true);
                            }}
                          >
                            <span class="iconify lucide--recycle text-green-500 dark:text-green-400" />
                          </PermissionButton>
                        )}
                      </Show>
                      <Tooltip text="Delete">
                        <button
                          type="button"
                          disabled={selected().size === 0}
                          onClick={() => {
                            setRecreate(false);
                            setOpenDelete(true);
                          }}
                          class={iconButtonClass}
                        >
                          <span class="iconify lucide--trash-2 text-red-500 dark:text-red-400" />
                        </button>
                      </Tooltip>
                    </Show>
                    <PermissionButton
                      scope={manage().scope}
                      class="flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-0.75 transition-colors hover:bg-neutral-200/50 active:bg-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                      disabledClass="flex items-center gap-1 rounded-md px-2 py-1 opacity-40"
                      onClick={() => (managing() ? stopManaging() : setManaging(true))}
                    >
                      {managing() ? "Cancel" : "Manage"}
                    </PermissionButton>
                  </>
                )}
              </Show>
            </div>
          </Show>
        </div>

        <Show when={lexicon.showSchema()}>
          <SchemaTabContent
            schema={lexicon.schema()}
            loading={lexicon.loading()}
            error={lexicon.error()}
          />
        </Show>

        <Show when={!lexicon.showSchema()}>
          <div class="flex w-full max-w-full flex-col px-1 pb-24 font-mono">
            <Show when={loading() && !loaded()}>
              <LoadingState label="Loading records…" />
            </Show>
            <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>
            <Show when={loaded() && filteredRecords().length === 0 && !error()}>
              <div class="font-sans">
                <EmptyState
                  icon={debouncedFilter() ? "lucide--search-x" : "lucide--file-json"}
                  message={debouncedFilter() ? "No records match your filter" : "No records found"}
                />
              </div>
            </Show>
            <For each={visibleRecords()}>
              {(record, index) => (
                <RecordRow
                  rkey={record.rkey}
                  cid={record.cid}
                  value={record.value}
                  repo={props.source.repo}
                  href={props.source.recordHref(record.rkey)}
                  onClick={managing() ? (event) => toggleRecord(record, index(), event) : undefined}
                  preview={preview(record)}
                  selected={managing() && selected().has(record.rkey)}
                  prevSelected={selected().has(filteredRecords()[index() - 1]?.rkey)}
                  nextSelected={selected().has(filteredRecords()[index() + 1]?.rkey)}
                />
              )}
            </For>
            <LoadMoreSentinel hasMore={hasMore} loading={loading} onLoadMore={loadMore} />
          </div>
        </Show>
      </div>

      <Modal
        open={openDelete()}
        onClose={() => !deleting() && setOpenDelete(false)}
        contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
      >
        <h2 class="mb-2 font-semibold">
          {recreate() ? "Recreate" : "Delete"} {selected().size} record
          {selected().size === 1 ? "" : "s"}?
        </h2>
        <div class="flex justify-end gap-2">
          <Button disabled={deleting()} onClick={() => setOpenDelete(false)}>
            Cancel
          </Button>
          <Button
            disabled={deleting()}
            onClick={() => void deleteRecords()}
            classList={{
              "bg-blue-500! text-white! hover:bg-blue-600! active:bg-blue-700! dark:bg-blue-600! dark:hover:bg-blue-500! dark:active:bg-blue-400! border-none!":
                recreate(),
              "text-white! border-none! bg-red-500! hover:bg-red-600! active:bg-red-700! disabled:opacity-60":
                !recreate(),
            }}
          >
            <Show when={deleting()}>
              <span class="iconify lucide--loader-circle animate-spin" />
            </Show>
            {recreate() ? "Recreate" : "Delete"}
          </Button>
        </div>
      </Modal>

      <Show when={!lexicon.showSchema() && (records().length > 1 || filter())}>
        <div class="bottom-controls-fade dark:bg-dark-500 fixed bottom-0 left-0 z-10 flex w-full flex-col items-center gap-2 bg-neutral-100 px-3 pt-3 pb-6">
          <div class="flex w-full max-w-[34.5rem] items-center gap-2">
            <FilterInput
              class="grow"
              inputClass="min-w-0 grow py-1 select-none placeholder:text-xs focus:outline-none"
              inputRef={(input) => (filterInputRef = input)}
              placeholder="Filter records..."
              value={filter()}
              onInput={(value) => {
                setFilter(value);
                setVisibleCount(PAGE_SIZE);
                setLastSelected(undefined);
              }}
            />
            <PreviewFieldMenu
              value={previewField()}
              options={previewFieldOptions()}
              onChange={(field) =>
                setSearchParams({ preview: field.trim() || undefined }, { replace: true })
              }
            />
          </div>

          <div class="flex min-h-7.5 w-full max-w-[34.5rem] items-center justify-between gap-2">
            <Button
              onClick={() => setSearchParams({ reverse: reverse() ? undefined : "true" })}
              classList={{
                "text-blue-500! dark:text-blue-400! border-blue-500! dark:border-blue-400!":
                  reverse(),
              }}
            >
              <span
                class={`iconify ${reverse() ? "lucide--arrow-down-wide-narrow" : "lucide--arrow-up-narrow-wide"}`}
              />
              Reverse
            </Button>

            <div class="shrink-0 text-sm">
              <Show when={managing()}>
                <span>{selected().size}</span>
                <span>/</span>
              </Show>
              <span>
                {(debouncedFilter() ? filteredRecords().length : records().length).toLocaleString()}
                {cursor() ? "+" : ""} record
                {(debouncedFilter() ? filteredRecords().length : records().length) === 1 &&
                !cursor()
                  ? ""
                  : "s"}
              </span>
            </div>

            <div class="flex w-20 items-center justify-end">
              <Show when={cursor()}>
                <Button
                  onClick={() => void loadRecords(false)}
                  disabled={loading()}
                  classList={{ "w-20 h-7.5 justify-center": true }}
                >
                  <Show
                    when={!loading()}
                    fallback={<span class="iconify lucide--loader-circle animate-spin text-base" />}
                  >
                    Load more
                  </Show>
                </Button>
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
};
