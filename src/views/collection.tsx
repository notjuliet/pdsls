import { ComAtprotoRepoApplyWrites, ComAtprotoRepoGetRecord } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { $type, ActorIdentifier, InferXRPCBodyOutput } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import { A, useBeforeLeave, useParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import { hasUserScope } from "../auth/scope-utils";
import { agent } from "../auth/state";
import { Button } from "../components/button.jsx";
import { JSONType, JSONValue } from "../components/json.jsx";
import { Modal } from "../components/modal.jsx";
import { addNotification, removeNotification } from "../components/notification.jsx";
import { StickyOverlay } from "../components/sticky.jsx";
import { TextInput } from "../components/text-input.jsx";
import Tooltip from "../components/tooltip.jsx";
import { isTouchDevice } from "../layout.jsx";
import { resolvePDS } from "../utils/api.js";
import { localDateFromTimestamp } from "../utils/date.js";
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

const LIMIT = 100;

const RecordLink = (props: { record: AtprotoRecord }) => {
  const [hover, setHover] = createSignal(false);
  const [previewHeight, setPreviewHeight] = createSignal(0);
  let rkeyRef!: HTMLSpanElement;
  let previewRef!: HTMLSpanElement;

  createEffect(() => {
    if (hover()) setPreviewHeight(previewRef.offsetHeight);
  });

  const isOverflowing = (previewHeight: number) =>
    rkeyRef.offsetTop - window.scrollY + previewHeight + 32 > window.innerHeight;

  return (
    <span
      class="relative flex w-full min-w-0 items-baseline rounded px-1 py-0.5"
      ref={rkeyRef}
      onmouseover={() => !isTouchDevice && setHover(true)}
      onmouseleave={() => !isTouchDevice && setHover(false)}
    >
      <span class="flex items-baseline truncate">
        <span class="shrink-0 text-sm text-blue-400">{props.record.rkey}</span>
        <span class="ml-1 truncate text-xs text-neutral-500 dark:text-neutral-400" dir="rtl">
          {props.record.cid}
        </span>
        <Show when={props.record.timestamp && props.record.timestamp <= Date.now()}>
          <span class="ml-1 shrink-0 text-xs">
            {localDateFromTimestamp(props.record.timestamp!)}
          </span>
        </Show>
      </span>
      <Show when={hover()}>
        <span
          ref={previewRef}
          class={`dark:bg-dark-300 dark:shadow-dark-700 pointer-events-none absolute left-[50%] z-25 block max-h-80 w-max max-w-sm -translate-x-1/2 overflow-hidden rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-xs whitespace-pre-wrap shadow-md sm:max-h-112 lg:max-w-lg dark:border-neutral-700 ${isOverflowing(previewHeight()) ? "bottom-7" : "top-7"}`}
        >
          <JSONValue
            data={props.record.record.value as JSONType}
            repo={props.record.record.uri.split("/")[2]}
            truncate
          />
        </span>
      </Show>
    </span>
  );
};

const CollectionView = () => {
  const params = useParams();
  const [cursor, setCursor] = createSignal<string>();
  const [records, setRecords] = createStore<AtprotoRecord[]>([]);
  const [filter, setFilter] = createSignal<string>();
  const [batchDelete, setBatchDelete] = createSignal(false);
  const [lastSelected, setLastSelected] = createSignal<number>();
  const [reverse, setReverse] = createSignal(false);
  const [recreate, setRecreate] = createSignal(false);
  const [openDelete, setOpenDelete] = createSignal(false);
  const [restoredFromCache, setRestoredFromCache] = createSignal(false);
  const did = params.repo;
  let pds: string;
  let rpc: Client;

  const cacheKey = () => `${params.pds}/${params.repo}/${params.collection}`;

  onMount(() => {
    const cached = getCollectionCache(cacheKey());
    if (cached) {
      setRecords(cached.records as AtprotoRecord[]);
      setCursor(cached.cursor);
      setReverse(cached.reverse);
      setRestoredFromCache(true);
      requestAnimationFrame(() => {
        window.scrollTo(0, cached.scrollY);
      });
    }
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

    if (!pds) pds = await resolvePDS(did!);
    if (!rpc) rpc = new Client({ handler: simpleFetchHandler({ service: pds }) });
    const res = await rpc.get("com.atproto.repo.listRecords", {
      params: {
        repo: did as ActorIdentifier,
        collection: params.collection as `${string}.${string}.${string}`,
        limit: LIMIT,
        cursor: cursor(),
        reverse: reverse(),
      },
    });
    if (!res.ok) throw new Error(res.data.error);
    setCursor(res.data.records.length < LIMIT ? undefined : res.data.cursor);
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
    setRecords(records.concat(tmpRecords) ?? tmpRecords);
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
    <Show when={records.length || response()}>
      <div class="-mt-2 flex w-full flex-col items-center">
        <StickyOverlay>
          <div class="flex w-full flex-col gap-2">
            <div class="flex items-center gap-1">
              <Show when={agent() && agent()?.sub === did && hasUserScope("delete")}>
                <div class="flex items-center">
                  <Tooltip
                    text={batchDelete() ? "Cancel" : "Delete"}
                    children={
                      <button
                        onclick={() => {
                          setRecords({ from: 0, to: records.length - 1 }, "toDelete", false);
                          setLastSelected(undefined);
                          setBatchDelete(!batchDelete());
                        }}
                        class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                      >
                        <span
                          class={`iconify ${batchDelete() ? "lucide--circle-x" : "lucide--trash-2"} `}
                        ></span>
                      </button>
                    }
                  />
                  <Show when={batchDelete()}>
                    <Tooltip
                      text="Select all"
                      children={
                        <button
                          onclick={() => selectAll()}
                          class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                        >
                          <span class="iconify lucide--copy-check"></span>
                        </button>
                      }
                    />
                    <Show when={hasUserScope("create")}>
                      <Tooltip
                        text="Recreate"
                        children={
                          <button
                            onclick={() => {
                              setRecreate(true);
                              setOpenDelete(true);
                            }}
                            class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                          >
                            <span class="iconify lucide--recycle text-green-500 dark:text-green-400"></span>
                          </button>
                        }
                      />
                    </Show>
                    <Tooltip
                      text="Delete"
                      children={
                        <button
                          onclick={() => {
                            setRecreate(false);
                            setOpenDelete(true);
                          }}
                          class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                        >
                          <span class="iconify lucide--trash-2 text-red-500 dark:text-red-400"></span>
                        </button>
                      }
                    />
                  </Show>
                </div>
                <Modal open={openDelete()} onClose={() => setOpenDelete(false)}>
                  <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute top-70 left-[50%] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 dark:border-neutral-700 starting:opacity-0">
                    <h2 class="mb-2 font-semibold">
                      {recreate() ? "Recreate" : "Delete"}{" "}
                      {records.filter((r) => r.toDelete).length} records?
                    </h2>
                    <div class="flex justify-end gap-2">
                      <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
                      <Button
                        onClick={deleteRecords}
                        class={`dark:shadow-dark-700 rounded-lg px-2 py-1.5 text-xs text-white shadow-xs select-none ${recreate() ? "bg-green-500 hover:bg-green-400 dark:bg-green-600 dark:hover:bg-green-500" : "bg-red-500 hover:bg-red-400 active:bg-red-400"}`}
                      >
                        {recreate() ? "Recreate" : "Delete"}
                      </Button>
                    </div>
                  </div>
                </Modal>
              </Show>
              <TextInput
                name="Filter"
                placeholder="Filter by substring"
                onInput={(e) => setFilter(e.currentTarget.value)}
                class="grow"
              />
              <Tooltip text="Jetstream">
                <A
                  href={`/jetstream?collections=${params.collection}&dids=${params.repo}`}
                  class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                >
                  <span class="iconify lucide--radio-tower"></span>
                </A>
              </Tooltip>
            </div>
            <Show when={records.length > 1}>
              <div class="flex items-center justify-between gap-x-2">
                <Button
                  onClick={() => {
                    setReverse(!reverse());
                    setRecords([]);
                    setCursor(undefined);
                    clearCollectionCache(cacheKey());
                    refetch();
                  }}
                >
                  <span
                    class={`iconify ${reverse() ? "lucide--clock-arrow-down" : "lucide--clock-arrow-up"}`}
                  ></span>
                  Reverse
                </Button>
                <div>
                  <Show when={batchDelete()}>
                    <span>{records.filter((rec) => rec.toDelete).length}</span>
                    <span>/</span>
                  </Show>
                  <span>{filter() ? filteredRecords().length : records.length} records</span>
                </div>
                <div class="flex w-20 items-center justify-end">
                  <Show when={cursor()}>
                    <Show when={!response.loading}>
                      <Button onClick={() => refetch()}>Load More</Button>
                    </Show>
                    <Show when={response.loading}>
                      <div class="iconify lucide--loader-circle w-20 animate-spin text-xl" />
                    </Show>
                  </Show>
                </div>
              </div>
            </Show>
          </div>
        </StickyOverlay>
        <div class="flex max-w-full flex-col px-2 font-mono">
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
        </div>
      </div>
    </Show>
  );
};

export { CollectionView };
