import { ComAtprotoRepoApplyWrites, ComAtprotoRepoGetRecord } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { $type, ActorIdentifier, InferXRPCBodyOutput } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import { Title } from "@solidjs/meta";
import { A, useBeforeLeave, useParams, useSearchParams } from "@solidjs/router";
import { createMemo, createResource, createSignal, For, onMount, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { agent } from "../auth/state";
import { Button } from "../components/button.jsx";
import HoverCard from "../components/hover-card/base";
import { JSONType, JSONValue } from "../components/json.jsx";
import { Modal } from "../components/modal.jsx";
import { addNotification, removeNotification } from "../components/notification.jsx";
import { PermissionButton } from "../components/permission-button.jsx";
import Tooltip from "../components/tooltip.jsx";
import { canHover } from "../layout.jsx";
import { resolvePDS } from "../utils/api.js";
import { localDateFromTimestamp } from "../utils/date.js";
import { useFilterShortcut } from "../utils/keyboard.js";
import {
  clearCollectionCache,
  getCollectionCache,
  setCollectionCache,
} from "../utils/route-cache.js";

interface AtprotoRecord {
  rkey: string;
  cid: string;
  record: InferXRPCBodyOutput<ComAtprotoRepoGetRecord.mainSchema["output"]>;
  timestamp: number | undefined;
  toDelete: boolean;
}

const DEFAULT_LIMIT = 100;

const RecordLink = (props: { record: AtprotoRecord }) => {
  return (
    <HoverCard
      class="flex w-full min-w-0 items-baseline rounded px-1 py-0.5"
      trigger={
        <>
          <span class="max-w-full shrink-0 truncate text-sm text-blue-500 dark:text-blue-400">
            {props.record.rkey}
          </span>
          <span class="ml-1 truncate text-xs text-neutral-500 dark:text-neutral-400" dir="rtl">
            {props.record.cid}
          </span>
          <Show when={props.record.timestamp && props.record.timestamp <= Date.now()}>
            <span class="ml-1 shrink-0 text-xs">
              {localDateFromTimestamp(props.record.timestamp!)}
            </span>
          </Show>
        </>
      }
    >
      <JSONValue
        data={props.record.record.value as JSONType}
        repo={props.record.record.uri.split("/")[2]}
        truncate
        hideBlobs
      />
    </HoverCard>
  );
};

const CollectionView = () => {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cursor, setCursor] = createSignal<string>();
  const [records, setRecords] = createStore<AtprotoRecord[]>([]);
  const [filter, setFilter] = createSignal<string>();
  const [batchDelete, setBatchDelete] = createSignal(false);
  const [lastSelected, setLastSelected] = createSignal<number>();
  const [reverse, setReverse] = createSignal(searchParams.reverse === "true");
  const limit = () => {
    const limitParam =
      Array.isArray(searchParams.limit) ? searchParams.limit[0] : searchParams.limit;
    const paramLimit = parseInt(limitParam || "");
    return !isNaN(paramLimit) && paramLimit > 0 && paramLimit <= 100 ? paramLimit : DEFAULT_LIMIT;
  };
  const [recreate, setRecreate] = createSignal(false);
  const [openDelete, setOpenDelete] = createSignal(false);
  const [restoredFromCache, setRestoredFromCache] = createSignal(false);
  const did = params.repo;
  let pds: string;
  let rpc: Client;
  let filterInputRef: HTMLInputElement | undefined;

  const cacheKey = () => `${params.pds}/${params.repo}/${params.collection}`;

  onMount(() => {
    const cached = getCollectionCache(cacheKey());
    if (cached) {
      setRecords(cached.records as AtprotoRecord[]);
      setCursor(cached.cursor);
      setReverse(cached.reverse);
      setSearchParams({
        reverse: cached.reverse ? "true" : undefined,
        limit: cached.limit !== DEFAULT_LIMIT ? cached.limit.toString() : undefined,
      });
      setRestoredFromCache(true);
      requestAnimationFrame(() => {
        window.scrollTo(0, cached.scrollY);
      });
    }

    useFilterShortcut(() => filterInputRef);
  });

  useBeforeLeave((e) => {
    const recordPathPrefix = `/at://${did}/${params.collection}/`;
    const isNavigatingToRecord = typeof e.to === "string" && e.to.startsWith(recordPathPrefix);

    if (isNavigatingToRecord && records.length > 0) {
      setCollectionCache(cacheKey(), {
        records: [...records],
        cursor: cursor(),
        scrollY: window.scrollY,
        reverse: reverse(),
        limit: limit(),
      });
    } else {
      clearCollectionCache(cacheKey());
    }
  });

  const fetchRecords = async () => {
    if (restoredFromCache() && records.length > 0 && !cursor()) {
      setRestoredFromCache(false);
      return records;
    }
    if (restoredFromCache()) setRestoredFromCache(false);

    const isLoadMore = cursor() !== undefined;

    if (!pds) pds = await resolvePDS(did!);
    if (!rpc) rpc = new Client({ handler: simpleFetchHandler({ service: pds }) });
    const res = await rpc.get("com.atproto.repo.listRecords", {
      params: {
        repo: did as ActorIdentifier,
        collection: params.collection as `${string}.${string}.${string}`,
        limit: limit(),
        cursor: cursor(),
        reverse: reverse(),
      },
    });
    if (!res.ok) throw new Error(res.data.error);
    setCursor(res.data.records.length < limit() ? undefined : res.data.cursor);
    const tmpRecords: AtprotoRecord[] = [];
    res.data.records.forEach((record) => {
      const rkey = record.uri.split("/").pop()!;
      tmpRecords.push({
        rkey: rkey,
        cid: record.cid,
        record: record,
        timestamp: TID.validate(rkey) ? TID.parse(rkey).timestamp / 1000 : undefined,
        toDelete: false,
      });
    });
    setRecords(isLoadMore ? records.concat(tmpRecords) : tmpRecords);
    return res.data.records;
  };

  const [response, { refetch }] = createResource(fetchRecords);

  const filteredRecords = createMemo(() =>
    records.filter((rec) =>
      filter() ? JSON.stringify(rec.record.value).includes(filter()!) : true,
    ),
  );

  const deleteRecords = async () => {
    const recsToDel = records.filter((record) => record.toDelete);
    let writes: Array<
      | $type.enforce<ComAtprotoRepoApplyWrites.Delete>
      | $type.enforce<ComAtprotoRepoApplyWrites.Create>
    > = [];
    recsToDel.forEach((record) => {
      writes.push({
        $type: "com.atproto.repo.applyWrites#delete",
        collection: params.collection as `${string}.${string}.${string}`,
        rkey: record.rkey,
      });
      if (recreate()) {
        writes.push({
          $type: "com.atproto.repo.applyWrites#create",
          collection: params.collection as `${string}.${string}.${string}`,
          rkey: record.rkey,
          value: record.record.value,
        });
      }
    });

    const BATCHSIZE = 200;
    rpc = new Client({ handler: agent()! });
    for (let i = 0; i < writes.length; i += BATCHSIZE) {
      await rpc.post("com.atproto.repo.applyWrites", {
        input: {
          repo: agent()!.sub,
          writes: writes.slice(i, i + BATCHSIZE),
        },
      });
    }
    const id = addNotification({
      message: `${recsToDel.length} records ${recreate() ? "recreated" : "deleted"}`,
      type: "success",
    });
    setTimeout(() => removeNotification(id), 3000);
    setBatchDelete(false);
    setRecords([]);
    setCursor(undefined);
    setOpenDelete(false);
    setRecreate(false);
    clearCollectionCache(cacheKey());
    refetch();
  };

  const handleSelectionClick = (e: MouseEvent, index: number) => {
    if (e.shiftKey && lastSelected() !== undefined)
      setRecords(
        {
          from: lastSelected()! < index ? lastSelected() : index + 1,
          to: index > lastSelected()! ? index - 1 : lastSelected(),
        },
        "toDelete",
        true,
      );
    else setLastSelected(index);
  };

  const selectAll = () =>
    setRecords(
      records
        .map((record, index) =>
          JSON.stringify(record.record.value).includes(filter() ?? "") ? index : undefined,
        )
        .filter((i) => i !== undefined),
      "toDelete",
      true,
    );

  return (
    <>
      <Title>{params.collection} - PDSls</Title>
      <Show when={records.length || response()}>
        <div class="flex w-full flex-col items-center">
          {/* Tab bar */}
          <div class="mb-2 flex min-h-7 w-full items-center justify-between px-2 text-sm sm:text-base">
            <div class="flex gap-4">
              <span class="border-b-2 font-medium">Records</span>
              <A
                href={`/jetstream?collections=${params.collection}&dids=${params.repo}`}
                class="border-b-2 border-transparent font-medium transition-colors not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80"
              >
                Jetstream
              </A>
            </div>
            <Show when={agent() && agent()?.sub === did}>
              <div class="flex items-center text-sm">
                <Show when={batchDelete()}>
                  <Tooltip text="Select all">
                    <button
                      onclick={() => selectAll()}
                      class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    >
                      <span class="iconify lucide--list-checks"></span>
                    </button>
                  </Tooltip>
                  <PermissionButton
                    scope="create"
                    tooltip="Recreate"
                    class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    disabledClass="flex items-center rounded-md p-1.5 opacity-40"
                    onClick={() => {
                      setRecreate(true);
                      setOpenDelete(true);
                    }}
                  >
                    <span class="iconify lucide--recycle text-green-500 dark:text-green-400"></span>
                  </PermissionButton>
                  <Tooltip text="Delete">
                    <button
                      onclick={() => {
                        setRecreate(false);
                        setOpenDelete(true);
                      }}
                      class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    >
                      <span class="iconify lucide--trash-2 text-red-500 dark:text-red-400"></span>
                    </button>
                  </Tooltip>
                </Show>
                <PermissionButton
                  scope="delete"
                  class="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  disabledClass="flex items-center gap-1 rounded-md px-2 py-1 opacity-40"
                  onClick={() => {
                    setRecords({ from: 0, to: records.length - 1 }, "toDelete", false);
                    setLastSelected(undefined);
                    setBatchDelete(!batchDelete());
                  }}
                >
                  <span
                    class={`iconify ${batchDelete() ? "lucide--x" : "lucide--square-check-big"}`}
                  ></span>
                  {batchDelete() ? "Cancel" : "Manage"}
                </PermissionButton>
              </div>
            </Show>
          </div>

          {/* Record list */}
          <div class="flex max-w-full flex-col px-2 pb-20 font-mono">
            <Show
              when={filteredRecords().length > 0}
              fallback={
                <span class="font-sans text-neutral-500 dark:text-neutral-400">
                  {filter() ? "No records match filter" : "No records"}
                </span>
              }
            >
              <For each={filteredRecords()}>
                {(record, index) => {
                  const rounding = () => {
                    const recs = filteredRecords();
                    const prevSelected = recs[index() - 1]?.toDelete;
                    const nextSelected = recs[index() + 1]?.toDelete;
                    return `${!prevSelected ? "rounded-t" : ""} ${!nextSelected ? "rounded-b" : ""}`;
                  };
                  return (
                    <>
                      <Show when={batchDelete()}>
                        <div
                          class={`select-none ${
                            record.toDelete ?
                              `bg-blue-200 hover:bg-blue-300/80 active:bg-blue-300 dark:bg-blue-700/30 dark:hover:bg-blue-700/50 dark:active:bg-blue-700/70 ${rounding()}`
                            : "rounded hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                          }`}
                          onclick={(e) => {
                            handleSelectionClick(e, index());
                            setRecords(index(), "toDelete", !record.toDelete);
                          }}
                        >
                          <RecordLink record={record} />
                        </div>
                      </Show>
                      <Show when={!batchDelete()}>
                        <A
                          href={`/at://${did}/${params.collection}/${record.rkey}`}
                          class="rounded select-none hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                        >
                          <RecordLink record={record} />
                        </A>
                      </Show>
                    </>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>

        {/* Confirm delete/recreate modal */}
        <Modal
          open={openDelete()}
          onClose={() => setOpenDelete(false)}
          contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
        >
          <h2 class="mb-2 font-semibold">
            {recreate() ? "Recreate" : "Delete"} {records.filter((r) => r.toDelete).length} records?
          </h2>
          <div class="flex justify-end gap-2">
            <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
            <Button
              onClick={deleteRecords}
              classList={{
                "bg-blue-500! text-white! hover:bg-blue-600! active:bg-blue-700! dark:bg-blue-600! dark:hover:bg-blue-500! dark:active:bg-blue-400! border-none!":
                  recreate(),
                "text-white! border-none! bg-red-500! hover:bg-red-600! active:bg-red-700!":
                  !recreate(),
              }}
            >
              {recreate() ? "Recreate" : "Delete"}
            </Button>
          </div>
        </Modal>

        {/* Fixed bottom panel */}
        <Show when={records.length > 1}>
          <div class="dark:bg-dark-500 fixed bottom-0 z-10 flex w-full flex-col items-center gap-2 border-t border-neutral-200 bg-neutral-100 px-3 pt-3 pb-6 dark:border-neutral-700">
            {/* Filter */}
            <div
              class="dark:bg-dark-200 flex w-full max-w-lg cursor-text items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 dark:border-neutral-700"
              onClick={(e) => {
                const input = e.currentTarget.querySelector("input");
                if (e.target !== input) input?.focus();
              }}
            >
              <span class="iconify lucide--filter text-neutral-500 dark:text-neutral-400"></span>
              <input
                ref={filterInputRef}
                type="text"
                spellcheck={false}
                autocapitalize="off"
                autocomplete="off"
                class="grow py-2 select-none placeholder:text-sm focus:outline-none"
                placeholder="Filter records..."
                onInput={(e) => setFilter(e.currentTarget.value)}
              />
              <Show when={canHover && !filter()}>
                <kbd class="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-xs text-neutral-400 select-none dark:border-neutral-600 dark:bg-neutral-700">
                  /
                </kbd>
              </Show>
            </div>

            {/* Pagination */}
            <div class="flex min-h-7.5 w-full max-w-lg items-center justify-between">
              <Button
                onClick={() => {
                  const newReverse = !reverse();
                  setReverse(newReverse);
                  setSearchParams({ reverse: newReverse ? "true" : undefined });
                  setCursor(undefined);
                  setRestoredFromCache(false);
                  clearCollectionCache(cacheKey());
                  refetch();
                }}
                classList={{
                  "text-blue-500! dark:text-blue-400! border-blue-500! dark:border-blue-400!":
                    reverse(),
                }}
              >
                <span
                  class={`iconify ${reverse() ? "lucide--arrow-down-wide-narrow" : "lucide--arrow-up-narrow-wide"}`}
                ></span>
                Reverse
              </Button>

              {/* Record count */}
              <div>
                <Show when={batchDelete()}>
                  <span>{records.filter((rec) => rec.toDelete).length}</span>
                  <span>/</span>
                </Show>
                <span>{filter() ? filteredRecords().length : records.length} records</span>
              </div>

              {/* Load more */}
              <div class="flex w-20 items-center justify-end">
                <Show when={cursor()}>
                  <Button
                    onClick={() => refetch()}
                    disabled={response.loading}
                    classList={{ "w-20 h-7.5 justify-center": true }}
                  >
                    <Show
                      when={!response.loading}
                      fallback={
                        <span class="iconify lucide--loader-circle animate-spin text-base" />
                      }
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
    </>
  );
};

export { CollectionView };
