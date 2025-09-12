import { ComAtprotoRepoApplyWrites, ComAtprotoRepoGetRecord } from "@atcute/atproto";
import { Client, CredentialManager } from "@atcute/client";
import { $type, ActorIdentifier, InferXRPCBodyOutput } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import { A, useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, For, Show, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import { Button } from "../components/button.jsx";
import { JSONType, JSONValue } from "../components/json.jsx";
import { agent } from "../components/login.jsx";
import { Modal } from "../components/modal.jsx";
import { StickyOverlay } from "../components/sticky.jsx";
import { TextInput } from "../components/text-input.jsx";
import Tooltip from "../components/tooltip.jsx";
import { setNotif } from "../layout.jsx";
import { resolvePDS } from "../utils/api.js";
import { localDateFromTimestamp } from "../utils/date.js";

interface AtprotoRecord {
  rkey: string;
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
      class="relative flex items-baseline rounded px-0.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
      ref={rkeyRef}
      onmouseover={() => setHover(true)}
      onmouseleave={() => setHover(false)}
    >
      <span class="text-sm text-blue-400 sm:text-base">{props.record.rkey}</span>
      <Show when={props.record.timestamp && props.record.timestamp <= Date.now()}>
        <span class="ml-1 text-xs text-neutral-500 dark:text-neutral-400">
          {localDateFromTimestamp(props.record.timestamp!)}
        </span>
      </Show>
      <Show when={hover()}>
        <span
          ref={previewRef}
          class={`dark:bg-dark-300 dark:shadow-dark-800 pointer-events-none absolute left-[50%] z-25 block max-h-[20rem] w-max max-w-sm -translate-x-1/2 overflow-hidden rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-xs whitespace-pre-wrap shadow-md sm:max-h-[28rem] lg:max-w-lg dark:border-neutral-700 ${isOverflowing(previewHeight()) ? "bottom-7" : "top-7"}`}
        >
          <JSONValue
            data={props.record.record.value as JSONType}
            repo={props.record.record.uri.split("/")[2]}
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
  const did = params.repo;
  let pds: string;
  let rpc: Client;

  const fetchRecords = async () => {
    if (!pds) pds = await resolvePDS(did);
    if (!rpc) rpc = new Client({ handler: new CredentialManager({ service: pds }) });
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
        record: record,
        timestamp: TID.validate(rkey) ? TID.parse(rkey).timestamp / 1000 : undefined,
        toDelete: false,
      });
    });
    setRecords(records.concat(tmpRecords) ?? tmpRecords);
    return res.data.records;
  };

  const [response, { refetch }] = createResource(fetchRecords);

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
    setNotif({
      show: true,
      icon: "lucide--trash-2",
      text: `${recsToDel.length} records ${recreate() ? "recreated" : "deleted"}`,
    });
    setBatchDelete(false);
    setRecords([]);
    setCursor(undefined);
    setOpenDelete(false);
    setRecreate(false);
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
          <div class="flex w-[22rem] items-center gap-1 sm:w-[24rem]">
            <Show when={agent() && agent()?.sub === did}>
              <div class="flex items-center">
                <Tooltip
                  text={batchDelete() ? "Cancel" : "Delete"}
                  children={
                    <button
                      onclick={() => {
                        setRecords(
                          { from: 0, to: untrack(() => records.length) - 1 },
                          "toDelete",
                          false,
                        );
                        setLastSelected(undefined);
                        setBatchDelete(!batchDelete());
                      }}
                      class="-ml-1 flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    >
                      <span
                        class={`iconify text-lg ${batchDelete() ? "lucide--circle-x" : "lucide--trash-2"} `}
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
                        class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                      >
                        <span class="iconify lucide--copy-check text-lg"></span>
                      </button>
                    }
                  />
                  <Tooltip
                    text="Recreate"
                    children={
                      <button
                        onclick={() => {
                          setRecreate(true);
                          setOpenDelete(true);
                        }}
                        class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                      >
                        <span class="iconify lucide--recycle text-lg text-green-500 dark:text-green-400"></span>
                      </button>
                    }
                  />
                  <Tooltip
                    text="Delete"
                    children={
                      <button
                        onclick={() => {
                          setRecreate(false);
                          setOpenDelete(true);
                        }}
                        class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                      >
                        <span class="iconify lucide--trash-2 text-lg text-red-500 dark:text-red-400"></span>
                      </button>
                    }
                  />
                </Show>
              </div>
              <Modal open={openDelete()} onClose={() => setOpenDelete(false)}>
                <div class="dark:bg-dark-300 dark:shadow-dark-800 absolute top-70 left-[50%] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-300 dark:border-neutral-700 starting:opacity-0">
                  <h2 class="mb-2 font-semibold">
                    {recreate() ? "Recreate" : "Delete"} {records.filter((r) => r.toDelete).length}{" "}
                    records?
                  </h2>
                  <div class="flex justify-end gap-2">
                    <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
                    <Button
                      onClick={deleteRecords}
                      class={`dark:shadow-dark-800 rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-200 shadow-xs select-none ${recreate() ? "bg-green-500 hover:bg-green-400 dark:bg-green-600 dark:hover:bg-green-500" : "bg-red-500 hover:bg-red-400 active:bg-red-400"}`}
                    >
                      {recreate() ? "Recreate" : "Delete"}
                    </Button>
                  </div>
                </div>
              </Modal>
            </Show>
            <Tooltip text="Jetstream">
              <A
                href={`/jetstream?collections=${params.collection}&dids=${params.repo}`}
                class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
              >
                <span class="iconify lucide--radio-tower text-lg"></span>
              </A>
            </Tooltip>
            <TextInput
              placeholder="Filter by substring"
              onInput={(e) => setFilter(e.currentTarget.value)}
              class="grow"
            />
          </div>
          <Show when={records.length > 1}>
            <div class="flex w-[22rem] items-center justify-between gap-x-2 sm:w-[24rem]">
              <Button
                onClick={() => {
                  setReverse(!reverse());
                  setRecords([]);
                  setCursor(undefined);
                  refetch();
                }}
              >
                <span
                  class={`iconify ${reverse() ? "lucide--rotate-ccw" : "lucide--rotate-cw"} text-sm`}
                ></span>
                Reverse
              </Button>
              <div>
                <Show when={batchDelete()}>
                  <span>{records.filter((rec) => rec.toDelete).length}</span>
                  <span>/</span>
                </Show>
                <span>{records.length} records</span>
              </div>
              <div class="flex w-[5rem] items-center justify-end">
                <Show when={cursor()}>
                  <Show when={!response.loading}>
                    <Button onClick={() => refetch()}>Load More</Button>
                  </Show>
                  <Show when={response.loading}>
                    <div class="iconify lucide--loader-circle w-[5rem] animate-spin text-xl" />
                  </Show>
                </Show>
              </div>
            </div>
          </Show>
        </StickyOverlay>
        <div class="flex max-w-full flex-col font-mono">
          <For
            each={records.filter((rec) =>
              filter() ? JSON.stringify(rec.record.value).includes(filter()!) : true,
            )}
          >
            {(record, index) => (
              <>
                <Show when={batchDelete()}>
                  <label
                    class="flex items-center gap-1 select-none"
                    onclick={(e) => handleSelectionClick(e, index())}
                  >
                    <input
                      type="checkbox"
                      checked={record.toDelete}
                      onchange={(e) => setRecords(index(), "toDelete", e.currentTarget.checked)}
                    />
                    <RecordLink record={record} />
                  </label>
                </Show>
                <Show when={!batchDelete()}>
                  <A href={`/at://${did}/${params.collection}/${record.rkey}`}>
                    <RecordLink record={record} />
                  </A>
                </Show>
              </>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
};

export { CollectionView };
