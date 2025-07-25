import { createEffect, createResource, createSignal, For, Show, untrack } from "solid-js";
import { CredentialManager, Client } from "@atcute/client";
import { A, useParams } from "@solidjs/router";
import { resolvePDS } from "../utils/api.js";
import * as TID from "@atcute/tid";
import { JSONType, JSONValue } from "../components/json.jsx";
import { agent, loginState } from "../components/login.jsx";
import { createStore } from "solid-js/store";
import Tooltip from "../components/tooltip.jsx";
import { localDateFromTimestamp } from "../utils/date.js";
import { $type, ActorIdentifier, InferXRPCBodyOutput } from "@atcute/lexicons";
import { ComAtprotoRepoApplyWrites, ComAtprotoRepoGetRecord } from "@atcute/atproto";
import { TextInput } from "../components/text-input.jsx";

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
      class="relative flex items-baseline rounded px-0.5 hover:bg-zinc-200 dark:hover:bg-neutral-700"
      ref={rkeyRef}
      onmouseover={() => setHover(true)}
      onmouseleave={() => setHover(false)}
    >
      <span class="text-blue-400">{props.record.rkey}</span>
      <Show when={props.record.timestamp && props.record.timestamp <= Date.now()}>
        <span class="ml-1 text-xs text-neutral-500 dark:text-neutral-400">
          {localDateFromTimestamp(props.record.timestamp!)}
        </span>
      </Show>
      <Show when={hover()}>
        <span
          ref={previewRef}
          class={`dark:bg-dark-800/70 left-50% max-h-md z-25 backdrop-blur-xs pointer-events-none absolute block w-max max-w-sm -translate-x-1/2 overflow-hidden whitespace-pre-wrap rounded-md border border-neutral-300 bg-zinc-50/70 p-2 text-xs shadow-lg lg:max-w-lg dark:border-neutral-700 ${isOverflowing(previewHeight()) ? "bottom-7" : "top-7"}`}
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
  const did = params.repo;
  let pds: string;
  let rpc: Client;

  const listRecords = (did: string, collection: string, cursor: string | undefined) =>
    rpc.get("com.atproto.repo.listRecords", {
      params: {
        repo: did as ActorIdentifier,
        collection: collection as `${string}.${string}.${string}`,
        limit: LIMIT,
        cursor: cursor,
        reverse: reverse(),
      },
    });

  const fetchRecords = async () => {
    if (!pds) pds = await resolvePDS(did);
    if (!rpc) rpc = new Client({ handler: new CredentialManager({ service: pds }) });
    const res = await listRecords(did, params.collection, cursor());
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
    const writes = records
      .filter((record) => record.toDelete)
      .map((record): $type.enforce<ComAtprotoRepoApplyWrites.Delete> => {
        return {
          $type: "com.atproto.repo.applyWrites#delete",
          collection: params.collection as `${string}.${string}.${string}`,
          rkey: record.rkey,
        };
      });

    const BATCHSIZE = 200;
    rpc = new Client({ handler: agent });
    for (let i = 0; i < writes.length; i += BATCHSIZE) {
      await rpc.post("com.atproto.repo.applyWrites", {
        input: {
          repo: agent.sub,
          writes: writes.slice(i, i + BATCHSIZE),
        },
      });
    }
    window.location.reload();
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
      <div class="z-5 dark:bg-dark-800 sticky top-0 mb-2 flex w-full flex-col items-center justify-center gap-2 border-b border-neutral-400 bg-zinc-50 py-3 dark:border-neutral-600">
        <div class="flex w-full items-center gap-2">
          <Show when={loginState() && agent.sub === did}>
            <div class="flex items-center gap-x-2">
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
                  >
                    <div
                      classList={{
                        "flex text-lg items-center": true,
                        "i-lucide-trash-2": !batchDelete(),
                        "i-lucide-circle-x hover:text-neutral-600 dark:hover:text-neutral-300":
                          batchDelete(),
                      }}
                    />
                  </button>
                }
              />
              <Show when={batchDelete()}>
                <Tooltip
                  text="Select All"
                  children={
                    <button onclick={() => selectAll()}>
                      <div class="i-lucide-copy-check text-lg text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300" />
                    </button>
                  }
                />
                <Tooltip
                  text="Confirm"
                  children={
                    <button onclick={() => deleteRecords()}>
                      <div class="i-lucide-trash-2 text-lg text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300" />
                    </button>
                  }
                />
              </Show>
            </div>
          </Show>
          <TextInput
            placeholder="Filter by substring"
            class="w-full"
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
        </div>
        <div class="flex items-center gap-x-2">
          <label class="flex select-none items-center gap-x-1">
            <input
              type="checkbox"
              checked={reverse()}
              onchange={async (e) => {
                setReverse(e.currentTarget.checked);
                setRecords([]);
                setCursor(undefined);
                await fetchRecords();
              }}
            />
            Reverse
          </label>
          <div>
            <Show when={batchDelete()}>
              <span>{records.filter((rec) => rec.toDelete).length}</span>
              <span>/</span>
            </Show>
            <span>
              {records.length} record{records.length > 1 ? "s" : ""}
            </span>
          </div>
          <Show when={cursor()}>
            <div class="flex h-[2rem] w-[5.5rem] items-center justify-center text-nowrap">
              <Show when={!response.loading}>
                <button
                  type="button"
                  onclick={() => refetch()}
                  class="dark:hover:bg-dark-300 rounded-lg border border-gray-400 bg-transparent px-2 py-1.5 text-xs font-bold hover:bg-zinc-100 focus:border-blue-500 focus:outline-none"
                >
                  Load More
                </button>
              </Show>
              <Show when={response.loading}>
                <div class="i-lucide-loader-circle animate-spin text-xl" />
              </Show>
            </div>
          </Show>
        </div>
      </div>
      <div class="flex flex-col font-mono">
        <For
          each={records.filter((rec) =>
            filter() ? JSON.stringify(rec.record.value).includes(filter()!) : true,
          )}
        >
          {(record, index) => (
            <>
              <Show when={batchDelete()}>
                <label
                  class="flex select-none items-center gap-1"
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
    </Show>
  );
};

export { CollectionView };
