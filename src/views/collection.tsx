import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { CredentialManager, Client } from "@atcute/client";
import { A, query, useParams } from "@solidjs/router";
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

const RecordLink = (props: { record: AtprotoRecord; index: number }) => {
  const [hoverRk, setHoverRk] = createSignal<HTMLSpanElement>();
  const [previewHeight, setPreviewHeight] = createSignal(0);

  createEffect(() => {
    const preview = hoverRk()?.querySelector(".preview");
    setPreviewHeight((preview as HTMLSpanElement)?.offsetHeight ?? 0);
  });

  const isOverflowing = (elem: HTMLElement, previewHeight: number) =>
    elem.offsetTop - window.scrollY + previewHeight + 32 > window.innerHeight;

  return (
    <span
      id={`rkey-${props.index}`}
      class="relative cursor-pointer rounded px-0.5 hover:bg-zinc-200 dark:hover:bg-neutral-700"
      onmouseover={(e) => setHoverRk(e.currentTarget)}
      onmouseleave={() => setHoverRk(undefined)}
    >
      <span class="text-lightblue-500">{props.record.rkey}</span>
      <Show when={props.record.timestamp && props.record.timestamp <= Date.now()}>
        <span class="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
          {localDateFromTimestamp(props.record.timestamp!)}
        </span>
      </Show>
      <Show when={hoverRk()?.id === `rkey-${props.index}`}>
        <span
          classList={{
            "preview w-max lg:max-w-lg max-w-sm bg-zinc-100 dark:bg-dark-500 left-50% border-neutral-400 dark:border-neutral-600 max-h-md pointer-events-none absolute z-25 mt-2 block -translate-x-1/2 overflow-hidden whitespace-pre-wrap rounded-md border p-2 text-xs":
              true,
            "bottom-8": isOverflowing(hoverRk()!, previewHeight()),
          }}
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
  const [modal, setModal] = createSignal<HTMLDialogElement>();
  const [openDelete, setOpenDelete] = createSignal(false);
  const did = params.repo;
  let pds: string;
  let rpc: Client;

  const clickEvent = (event: MouseEvent) => {
    if (modal() && event.target === modal()) setOpenDelete(false);
  };
  const keyDownEvent = (event: KeyboardEvent) => {
    if (modal() && event.key === "Escape") setOpenDelete(false);
  };

  onMount(() => {
    window.addEventListener("click", clickEvent);
    window.addEventListener("keydown", keyDownEvent);
  });

  onCleanup(() => {
    window.removeEventListener("click", clickEvent);
    window.removeEventListener("keydown", keyDownEvent);
  });

  const listRecords = query(
    (did: string, collection: string, cursor: string | undefined) =>
      rpc.get("com.atproto.repo.listRecords", {
        params: {
          repo: did as ActorIdentifier,
          collection: collection as `${string}.${string}.${string}`,
          limit: LIMIT,
          cursor: cursor,
        },
      }),
    "listRecords",
  );

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

  const unselectAll = () => {
    setRecords({ from: 0, to: records.length - 1 }, "toDelete", false);
    setLastSelected(undefined);
  };

  return (
    <Show when={records.length || response()}>
      <div class="z-5 dark:bg-dark-800 sticky top-0 mb-2 flex w-full flex-col items-center justify-center gap-2 border-b border-neutral-500 bg-zinc-100 py-4">
        <div class="flex w-full items-center gap-2">
          <Show when={loginState() && agent.sub === did}>
            <div
              classList={{
                "flex items-center gap-x-2": true,
                "border py-1.5 px-2 rounded-md border-neutral-500": batchDelete(),
              }}
            >
              <Tooltip
                text={batchDelete() ? "Cancel" : "Delete"}
                children={
                  <button
                    classList={{
                      "flex text-lg items-center": true,
                      "i-lucide-trash-2 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300":
                        !batchDelete(),
                      "i-lucide-circle-x text-neutral-500 hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-300":
                        batchDelete(),
                    }}
                    onclick={() => {
                      setRecords(
                        { from: 0, to: untrack(() => records.length) - 1 },
                        "toDelete",
                        false,
                      );
                      setLastSelected(undefined);
                      setBatchDelete(!batchDelete());
                    }}
                  />
                }
              />
              <Show when={batchDelete()}>
                <Tooltip
                  text="Select All"
                  children={
                    <button
                      class="i-lucide-copy-check text-lg text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                      onclick={() => selectAll()}
                    />
                  }
                />
                <Tooltip
                  text="Unselect All"
                  children={
                    <button
                      class="i-lucide-copy text-lg text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                      onclick={() => unselectAll()}
                    />
                  }
                />
                <Tooltip
                  text="Confirm"
                  children={
                    <button
                      class="i-lucide-trash-2 text-lg text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                      onclick={() => setOpenDelete(true)}
                    />
                  }
                />
                <Show when={openDelete()}>
                  <dialog
                    ref={setModal}
                    class="z-2 backdrop-brightness-60 fixed left-0 top-0 flex h-screen w-screen items-center justify-center bg-transparent"
                  >
                    <div class="dark:bg-dark-400 rounded-md border border-neutral-500 bg-zinc-100 p-3 text-slate-900 dark:text-slate-100">
                      <h3 class="text-lg font-bold">
                        Delete {records.filter((rec) => rec.toDelete).length} records?
                      </h3>
                      <div class="mt-2 inline-flex gap-2">
                        <button
                          onclick={() => setOpenDelete(false)}
                          class="dark:bg-dark-900 dark:hover:bg-dark-800 bg-light-100 rounded-lg border border-neutral-500 px-2.5 py-1.5 text-sm font-bold hover:bg-zinc-200 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onclick={() => deleteRecords()}
                          class="rounded-lg bg-red-500 px-2.5 py-1.5 text-sm font-bold text-slate-100 hover:bg-red-400 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:bg-red-600 dark:hover:bg-red-500 dark:focus:ring-slate-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </dialog>
                </Show>
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
                  class="dark:hover:bg-dark-300 rounded-lg border border-gray-400 bg-transparent px-2 py-1.5 text-sm font-bold hover:bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  Load More
                </button>
              </Show>
              <Show when={response.loading}>
                <div class="i-eos-icons-loading text-2xl" />
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
                  <RecordLink record={record} index={index()} />
                </label>
              </Show>
              <Show when={!batchDelete()}>
                <A href={`/at://${did}/${params.collection}/${record.rkey}`}>
                  <RecordLink record={record} index={index()} />
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
