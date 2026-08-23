import * as TID from "@atcute/tid";
import { A, type RouteSectionProps, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

import { SPACE_MANAGE_RECORDS_SCOPE_ID } from "../../auth/scope-utils";
import { Button } from "../../components/button.jsx";
import { FilterInput } from "../../components/filter-input.jsx";
import HoverCard from "../../components/hover-card/base.jsx";
import { JSONValue } from "../../components/json.jsx";
import { Modal } from "../../components/modal.jsx";
import { NestedLayout } from "../../components/nested-layout.jsx";
import { addNotification, removeNotification } from "../../components/notification.jsx";
import { PermissionButton } from "../../components/permission-button.jsx";
import Tooltip from "../../components/tooltip.jsx";
import { SchemaTabContent, useLexiconSchema } from "../../lib/schema-tab.jsx";
import { deleteSpaceRecords, listSpaceRecords, type SpaceRecord } from "../../lib/spaces.js";
import { localDateFromTimestamp } from "../../utils/date.js";
import {
  makeSpaceCollectionPath,
  makeSpaceRecordPath,
  makeSpaceRef,
  useSpaceRecords,
  useSpacesAuth,
} from "./context.jsx";
import { SpaceRecordEditor } from "./create-record.jsx";
import { EmptyState, ErrorNotice, LoadingState } from "./shared.jsx";

const RECORDS_PER_PAGE = 100;

const SpaceCollectionView = () => {
  const auth = useSpacesAuth();
  const spaceRecords = useSpaceRecords();
  const params = useParams();
  const hidden = () => !!params.rkey;
  const repo = () => params.spaceRepo!;
  const [records, setRecords] = createSignal<SpaceRecord[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [filter, setFilter] = createSignal("");
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [managing, setManaging] = createSignal(false);
  const [selectedRkeys, setSelectedRkeys] = createSignal(new Set<string>());
  const [lastSelected, setLastSelected] = createSignal<number>();
  const [openDelete, setOpenDelete] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const lexicon = useLexiconSchema(() => params.collection);
  let activeKey = "";
  let requestVersion = 0;

  const space = () => makeSpaceRef(params.spaceAuthority!, params.spaceType!, params.skey!);
  const collectionPath = () =>
    makeSpaceCollectionPath(
      params.spaceAuthority!,
      params.spaceType!,
      params.skey!,
      repo(),
      params.collection!,
    );

  const filteredRecords = createMemo(() => {
    const value = filter().trim().toLowerCase();
    if (!value) return records();
    return records().filter((record) => {
      const recordValue = record.value === undefined ? "" : JSON.stringify(record.value);
      return `${record.rkey}\n${record.cid}\n${recordValue}`.toLowerCase().includes(value);
    });
  });

  const selectedCount = () => selectedRkeys().size;

  const toggleRecord = (record: SpaceRecord, index: number, event: MouseEvent) => {
    const selected = new Set(selectedRkeys());
    if (event.shiftKey && lastSelected() !== undefined) {
      const start = Math.min(lastSelected()!, index);
      const end = Math.max(lastSelected()!, index);
      for (const item of filteredRecords().slice(start, end + 1)) selected.add(item.rkey);
      if (selectedRkeys().has(record.rkey)) selected.delete(record.rkey);
    } else {
      setLastSelected(index);
      if (selected.has(record.rkey)) selected.delete(record.rkey);
      else selected.add(record.rkey);
    }
    setSelectedRkeys(selected);
  };

  const selectAll = () => {
    setSelectedRkeys(new Set(filteredRecords().map((record) => record.rkey)));
    setLastSelected(undefined);
  };

  const stopManaging = () => {
    setManaging(false);
    setSelectedRkeys(new Set<string>());
    setLastSelected(undefined);
  };

  createEffect(() => {
    if (lexicon.showSchema()) {
      stopManaging();
      setOpenDelete(false);
    }
  });

  const loadRecords = async (reset = false, version = requestVersion) => {
    if (loading() && !reset) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await listSpaceRecords(auth(), space(), repo(), {
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
    const key = `${auth().sub}\n${space()}\n${repo()}\n${params.collection}\n${spaceRecords.recordsVersion()}`;
    if (key !== activeKey) {
      activeKey = key;
      requestVersion += 1;
      setRecords([]);
      setCursor(undefined);
      setFilter("");
      stopManaging();
      setLoaded(false);
      setLoading(false);
      setError(undefined);
    }
    if (!hidden() && !loaded() && !loading()) void loadRecords(true, requestVersion);
  });

  const deleteRecords = async () => {
    if (deleting() || selectedCount() === 0 || repo() !== auth().sub) return;

    const recordsToDelete = records()
      .filter((record) => selectedRkeys().has(record.rkey))
      .map((record) => ({ collection: record.collection, rkey: record.rkey }));
    if (recordsToDelete.length === 0) return;

    setDeleting(true);
    try {
      await deleteSpaceRecords(auth(), space(), repo(), recordsToDelete);
      const notification = addNotification({
        message: `${recordsToDelete.length} record${recordsToDelete.length === 1 ? "" : "s"} deleted`,
        type: "success",
      });
      setTimeout(() => removeNotification(notification), 3000);
    } catch (err) {
      const notification = addNotification({
        message: err instanceof Error ? err.message : "Could not delete the Space records",
        type: "error",
      });
      setTimeout(() => removeNotification(notification), 5000);
    } finally {
      setDeleting(false);
      setOpenDelete(false);
      stopManaging();
      spaceRecords.invalidateRecords();
    }
  };

  return (
    <Show when={!hidden()}>
      <div class="flex w-full flex-col gap-3 py-2 pb-10">
        <div class="flex min-h-7 w-full items-center justify-between px-2 text-sm sm:text-base">
          <div class="flex items-center gap-3 sm:gap-4">
            <A
              href={collectionPath()}
              classList={{
                "border-b-2 font-medium transition-colors": true,
                "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
                  lexicon.showSchema(),
              }}
            >
              Records
            </A>
            <A
              href={`${collectionPath()}#schema`}
              classList={{
                "border-b-2 font-medium transition-colors": true,
                "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
                  !lexicon.showSchema(),
              }}
            >
              Schema
            </A>
          </div>

          <Show when={!lexicon.showSchema() && repo() === auth().sub}>
            <div class="flex items-center gap-1.5 text-sm">
              <Show when={!managing()}>
                <SpaceRecordEditor
                  authority={params.spaceAuthority!}
                  type={params.spaceType!}
                  skey={params.skey!}
                  space={space()}
                  collection={params.collection!}
                />
              </Show>
              <Show when={managing()}>
                <div class="flex items-center">
                  <Tooltip text="Select all">
                    <button
                      onclick={selectAll}
                      class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    >
                      <span class="iconify lucide--list-checks" />
                    </button>
                  </Tooltip>
                  <Tooltip text="Delete">
                    <button
                      disabled={selectedCount() === 0}
                      onclick={() => setOpenDelete(true)}
                      class="flex items-center rounded-md p-1.5 text-red-500 hover:bg-neutral-200 active:bg-neutral-300 disabled:opacity-40 dark:text-red-400 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    >
                      <span class="iconify lucide--trash-2" />
                    </button>
                  </Tooltip>
                </div>
              </Show>
              <PermissionButton
                scope={SPACE_MANAGE_RECORDS_SCOPE_ID}
                class="flex items-center gap-1 rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs transition-colors hover:bg-neutral-200/50 active:bg-neutral-200 sm:px-2 sm:py-0.75 sm:text-sm dark:border-neutral-700 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                disabledClass="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs opacity-40 sm:px-2 sm:py-1 sm:text-sm"
                onClick={() => (managing() ? stopManaging() : setManaging(true))}
              >
                {managing() ? "Cancel" : "Manage"}
              </PermissionButton>
            </div>
          </Show>
        </div>

        <Show when={!lexicon.showSchema()}>
          <div class="flex items-center gap-2 px-2">
            <FilterInput
              class="grow"
              placeholder="Filter records..."
              value={filter()}
              onInput={(value) => {
                setFilter(value);
                setLastSelected(undefined);
              }}
            />
            <div class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
              <Show
                when={managing()}
                fallback={
                  <>
                    <Show when={filter().trim()}>
                      {filteredRecords().length.toLocaleString()} /{" "}
                      {records().length.toLocaleString()}
                      {cursor() ? "+" : ""}{" "}
                    </Show>
                    <Show when={!filter().trim()}>
                      {records().length.toLocaleString()}
                      {cursor() ? "+" : ""}{" "}
                    </Show>
                    record{records().length === 1 && !cursor() ? "" : "s"}
                  </>
                }
              >
                {selectedCount().toLocaleString()} selected
              </Show>
            </div>
          </div>

          <Show when={loading() && !loaded()}>
            <LoadingState label="Loading records…" />
          </Show>

          <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

          <Show when={loaded() && (!error() || records().length > 0)}>
            <div class="flex flex-col px-1 font-mono">
              <For each={filteredRecords()}>
                {(record, index) => {
                  const timestamp = () =>
                    TID.validate(record.rkey) ? TID.parse(record.rkey).timestamp / 1000 : undefined;

                  const summary = () => (
                    <>
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
                    </>
                  );

                  return (
                    <HoverCard
                      class={`flex w-full min-w-0 items-baseline rounded ${
                        managing() && selectedRkeys().has(record.rkey)
                          ? "bg-blue-200 hover:bg-blue-300/80 active:bg-blue-300 dark:bg-blue-700/30 dark:hover:bg-blue-700/50 dark:active:bg-blue-700/70"
                          : "hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                      }`}
                      activeClass={
                        managing() && selectedRkeys().has(record.rkey)
                          ? "bg-blue-300/80 dark:bg-blue-700/50"
                          : "bg-neutral-200 dark:bg-neutral-800"
                      }
                      previewPlacement="side"
                      trigger={
                        <Show
                          when={managing()}
                          fallback={
                            <A
                              href={makeSpaceRecordPath(
                                params.spaceAuthority!,
                                params.spaceType!,
                                params.skey!,
                                repo(),
                                params.collection!,
                                record.rkey,
                              )}
                              class="flex w-full min-w-0 items-baseline gap-1 px-1 py-0.5"
                            >
                              {summary()}
                            </A>
                          }
                        >
                          <button
                            type="button"
                            aria-pressed={selectedRkeys().has(record.rkey)}
                            onclick={(event) => toggleRecord(record, index(), event)}
                            class="flex w-full min-w-0 items-baseline gap-1 px-1 py-0.5 text-left select-none"
                          >
                            {summary()}
                          </button>
                        </Show>
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
                        <JSONValue data={record.value!} repo={repo()} truncate hideBlobs preview />
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
        </Show>

        <Show when={lexicon.showSchema()}>
          <SchemaTabContent
            schema={lexicon.schema()}
            loading={lexicon.loading()}
            error={lexicon.error()}
          />
        </Show>
      </div>

      <Modal
        open={openDelete()}
        onClose={() => !deleting() && setOpenDelete(false)}
        contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
      >
        <h2 class="mb-2 font-semibold">
          Delete {selectedCount()} record{selectedCount() === 1 ? "" : "s"}?
        </h2>
        <div class="flex justify-end gap-2">
          <Button disabled={deleting()} onClick={() => setOpenDelete(false)}>
            Cancel
          </Button>
          <Button
            disabled={deleting() || selectedCount() === 0}
            onClick={() => void deleteRecords()}
            classList={{
              "text-white! border-none! bg-red-500! hover:bg-red-600! active:bg-red-700! disabled:opacity-60": true,
            }}
          >
            <Show when={deleting()}>
              <span class="iconify lucide--loader-circle animate-spin" />
            </Show>
            {deleting() ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Modal>
    </Show>
  );
};

export const SpaceCollectionLayout = (props: RouteSectionProps) => {
  const params = useParams();
  const hasChild = () => !!params.rkey;
  const key = () =>
    `${params.spaceAuthority}/${params.spaceType}/${params.skey}/${params.spaceRepo}/${params.collection}`;

  return (
    <NestedLayout key={key()} hasChild={hasChild()} view={() => <SpaceCollectionView />}>
      {props.children}
    </NestedLayout>
  );
};
