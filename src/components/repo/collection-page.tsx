import { useSearchParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, type JSX, onMount, Show } from "solid-js";

import type { ScopeId } from "../../auth/scope-utils";
import { createDebouncedValue } from "../../lib/debounced.js";
import { LoadMoreSentinel } from "../../lib/infinite-scroll.jsx";
import { useFilterShortcut } from "../../lib/keyboard.js";
import type { JSONType } from "../json.jsx";
import { Button } from "../ui/button.jsx";
import { ConfirmDialog } from "../ui/confirm-dialog.jsx";
import { FilterInput } from "../ui/filter-input.jsx";
import { IconButton } from "../ui/icon-button.jsx";
import { addNotification } from "../ui/notification.jsx";
import { PermissionButton } from "../ui/permission-button.jsx";
import { Spinner, EmptyState, ErrorNotice, LoadingState } from "../ui/states.jsx";
import { Tabs } from "../ui/tabs.jsx";
import {
  addPreviewFieldOptions,
  formatPreviewValue,
  getPathValue,
  PreviewFieldMenu,
} from "./preview-field.jsx";
import { RecordRow } from "./record-row.jsx";

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

export const CollectionPage = (props: {
  source: CollectionSource;
  /** Keeps the loaded records while a record of this collection is open. */
  hidden?: boolean;
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
  const shownCount = () => (debouncedFilter() ? filteredRecords() : records()).length;
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
          <Tabs
            items={[{ id: "records", label: "Records", href: props.source.collectionHref }]}
            active="records"
          />
          <div class="flex items-center text-sm sm:gap-1">
            <Show when={!managing()}>{props.actions}</Show>
            <Show when={props.source.manage}>
              {(manage) => (
                <>
                  <Show when={managing()}>
                    <IconButton icon="lucide--list-checks" label="Select all" onClick={selectAll} />
                    <Show when={manage().recreateScope}>
                      {(scope) => (
                        <IconButton
                          icon="lucide--recycle"
                          iconClass="text-green-500 dark:text-green-400"
                          label="Recreate"
                          scope={scope()}
                          onClick={() => {
                            setRecreate(true);
                            setOpenDelete(true);
                          }}
                        />
                      )}
                    </Show>
                    <IconButton
                      icon="lucide--trash-2"
                      iconClass="text-red-500 dark:text-red-400"
                      label="Delete"
                      disabled={selected().size === 0}
                      onClick={() => {
                        setRecreate(false);
                        setOpenDelete(true);
                      }}
                    />
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
        </div>

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
      </div>

      <ConfirmDialog
        open={openDelete()}
        onClose={() => setOpenDelete(false)}
        onConfirm={() => void deleteRecords()}
        title={`${recreate() ? "Recreate" : "Delete"} ${selected().size} record${selected().size === 1 ? "" : "s"}?`}
        description={recreate() ? undefined : "This cannot be undone."}
        confirmLabel={recreate() ? "Recreate" : "Delete"}
        variant={recreate() ? "primary" : "danger"}
        busy={deleting()}
      />

      <Show when={records().length > 1 || filter()}>
        <div class="bottom-controls-fade dark:bg-dark-500 fixed bottom-0 left-0 z-10 flex w-full flex-col items-center gap-2 bg-neutral-100 px-3 pt-3 pb-6">
          <div class="flex w-full max-w-[40.5rem] items-center gap-2">
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

          <div class="flex min-h-7.5 w-full max-w-[40.5rem] items-center justify-between gap-2">
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
                {shownCount().toLocaleString()} record{shownCount() === 1 ? "" : "s"}
              </span>
            </div>

            <div class="flex w-20 items-center justify-end">
              <Show when={cursor()}>
                <Button
                  onClick={() => void loadRecords(false)}
                  disabled={loading()}
                  classList={{ "w-20 h-7.5 justify-center": true }}
                >
                  <Show when={!loading()} fallback={<Spinner class="text-base" />}>
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
