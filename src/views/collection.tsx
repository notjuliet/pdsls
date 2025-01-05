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
import { CredentialManager, XRPC } from "@atcute/client";
import {
  Brand,
  ComAtprotoRepoApplyWrites,
  ComAtprotoRepoListRecords,
} from "@atcute/client/lexicons";
import { action, query, useNavigate, useParams } from "@solidjs/router";
import { resolvePDS } from "../utils/api.js";
import * as TID from "@atcute/tid";
import { resolveHandle } from "@atcute/oauth-browser-client";
import { JSONType, JSONValue } from "../components/json.jsx";
import { agent, loginState } from "./login.jsx";
import { createStore } from "solid-js/store";
import Tooltip from "../components/tooltip.jsx";

interface AtprotoRecord {
  rkey: string;
  record: ComAtprotoRepoListRecords.Record;
  timestamp: number | undefined;
  toDelete: boolean;
}

const CollectionView = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [cursor, setCursor] = createSignal<string>();
  const [records, setRecords] = createStore<AtprotoRecord[]>([]);
  const [filter, setFilter] = createSignal<string>();
  const [hoverRk, setHoverRk] = createSignal<HTMLSpanElement>();
  const [previewHeight, setPreviewHeight] = createSignal(0);
  const [batchDelete, setBatchDelete] = createSignal(false);
  const [lastSelected, setLastSelected] = createSignal<number>();
  const [modal, setModal] = createSignal<HTMLDialogElement>();
  const [openDelete, setOpenDelete] = createSignal(false);
  let did = params.repo;
  let pds: string;
  let rpc: XRPC;

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
          repo: did,
          collection: collection,
          limit: 100,
          cursor: cursor,
        },
      }),
    "listRecords",
  );

  const fetchRecords = async () => {
    if (!did.startsWith("did:")) did = await resolveHandle(params.repo);
    if (!pds) pds = await resolvePDS(did);
    if (!rpc)
      rpc = new XRPC({ handler: new CredentialManager({ service: pds }) });
    const res = await listRecords(did, params.collection, cursor());
    setCursor(res.data.records.length < 100 ? undefined : res.data.cursor);
    const tmpRecords: AtprotoRecord[] = [];
    res.data.records.forEach((record) => {
      const rkey = record.uri.split("/").pop()!;
      tmpRecords.push({
        rkey: rkey,
        record: record,
        timestamp:
          TID.validate(rkey) ? TID.parse(rkey).timestamp / 1000 : undefined,
        toDelete: false,
      });
    });
    setRecords(records.concat(tmpRecords) ?? tmpRecords);
    return res.data.records;
  };

  const [response, { refetch }] = createResource(fetchRecords);

  const getDateFromTimestamp = (timestamp: number) =>
    new Date(timestamp - new Date().getTimezoneOffset() * 60 * 1000)
      .toISOString()
      .split(".")[0]
      .replace("T", " ");

  createEffect(() => {
    const preview = hoverRk()?.querySelector(".preview");
    setPreviewHeight((preview as HTMLSpanElement)?.offsetHeight ?? 0);
  });

  const isOverflowing = (elem: HTMLElement, previewHeight: number) =>
    elem.offsetTop - window.scrollY + previewHeight + 40 > window.innerHeight;

  const deleteRecords = action(async () => {
    const writes = records
      .filter((record) => record.toDelete)
      .map((record): Brand.Union<ComAtprotoRepoApplyWrites.Delete> => {
        return {
          $type: "com.atproto.repo.applyWrites#delete",
          collection: params.collection,
          rkey: record.rkey,
        };
      });

    const BATCHSIZE = 200;
    rpc = new XRPC({ handler: agent });
    for (let i = 0; i < writes.length; i += BATCHSIZE) {
      await rpc.call("com.atproto.repo.applyWrites", {
        data: {
          repo: agent.sub,
          writes: writes.slice(i, i + BATCHSIZE),
        },
      });
    }
    window.location.reload();
  });

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
          JSON.stringify(record.record.value).includes(filter() ?? "") ?
            index
          : undefined,
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
      <div
        classList={{
          "mb-3 flex w-full items-center justify-center gap-2": true,
          "flex-col md:flex-row": batchDelete(),
        }}
      >
        <Show when={loginState() && agent.sub === did}>
          <div
            classList={{
              "flex items-center gap-x-2": true,
              "border p-1 rounded-md border-neutral-500": batchDelete(),
            }}
          >
            <Tooltip
              text={batchDelete() ? "Cancel" : "Delete"}
              children={
                <button
                  classList={{
                    "flex items-center text-xl": true,
                    "i-ic-round-delete-sweep text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300":
                      !batchDelete(),
                    "i-fluent-dismiss-circle-12-regular text-neutral-500 hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-300":
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
                    class="i-mdi-checkbox-multiple-marked text-xl text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    onclick={() => selectAll()}
                  />
                }
              />
              <Tooltip
                text="Unselect All"
                children={
                  <button
                    class="i-mdi-checkbox-multiple-blank-outline text-xl text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    onclick={() => unselectAll()}
                  />
                }
              />
              <Tooltip
                text="Confirm"
                children={
                  <button
                    class="i-ic-round-delete-sweep text-xl text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                    onclick={() => setOpenDelete(true)}
                  />
                }
              />
              <Show when={openDelete()}>
                <dialog
                  ref={setModal}
                  class="z-2 fixed left-0 top-0 flex h-screen w-screen items-center justify-center bg-transparent"
                >
                  <div class="dark:bg-dark-400 rounded-md border border-neutral-500 bg-slate-100 p-3 text-slate-900 dark:text-slate-100">
                    <h3 class="text-lg font-bold">
                      Delete {records.filter((rec) => rec.toDelete).length}{" "}
                      records?
                    </h3>
                    <form action={deleteRecords} method="post">
                      <div class="mt-2 inline-flex gap-2">
                        <button
                          onclick={() => setOpenDelete(false)}
                          class="dark:bg-dark-900 dark:hover:bg-dark-800 rounded-lg border border-neutral-500 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          class="rounded-lg bg-red-500 px-2.5 py-1.5 text-sm font-bold text-slate-100 hover:bg-red-400 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:bg-red-600 dark:hover:bg-red-500 dark:focus:ring-slate-300"
                        >
                          Delete
                        </button>
                      </div>
                    </form>
                  </div>
                </dialog>
              </Show>
            </Show>
          </div>
        </Show>
        <input
          type="text"
          spellcheck={false}
          placeholder="Filter by substring"
          class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          onInput={(e) => setFilter(e.currentTarget.value)}
        />
      </div>
      <div class="flex flex-col font-mono">
        <p class="font-sans font-semibold text-stone-600 dark:text-stone-400">
          Records
        </p>
        <For
          each={records.filter((rec) =>
            filter() ?
              JSON.stringify(rec.record.value).includes(filter()!)
            : true,
          )}
        >
          {(record, index) => (
            <label
              class="flex items-center gap-1"
              onclick={(e) =>
                batchDelete() ?
                  handleSelectionClick(e, index())
                : navigate(`${record.rkey}`)
              }
            >
              <Show when={batchDelete()}>
                <input
                  type="checkbox"
                  checked={record.toDelete}
                  onchange={(e) =>
                    setRecords(index(), "toDelete", e.currentTarget.checked)
                  }
                />
              </Show>
              <span
                id={`rkey-${index()}`}
                class="relative cursor-pointer select-none hover:bg-neutral-300 dark:hover:bg-neutral-700"
                onmouseover={(e) => setHoverRk(e.currentTarget)}
                onmouseleave={() => setHoverRk(undefined)}
              >
                <span class="text-lightblue-500">{record.rkey}</span>
                <Show when={record.timestamp && record.timestamp <= Date.now()}>
                  <span class="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                    {getDateFromTimestamp(record.timestamp!)}
                  </span>
                </Show>
                <Show when={hoverRk()?.id === `rkey-${index()}`}>
                  <span
                    classList={{
                      "preview w-fit lg:max-w-lg max-w-sm bg-slate-100 dark:bg-dark-500 left-50% border-neutral-400 dark:border-neutral-600 max-h-md pointer-events-none absolute z-2 mt-4 block -translate-x-1/2 overflow-hidden whitespace-pre-wrap rounded-md border p-2 text-xs":
                        true,
                      "bottom-10": isOverflowing(hoverRk()!, previewHeight()),
                    }}
                  >
                    <JSONValue
                      data={record.record.value as JSONType}
                      repo={record.record.uri.split("/")[2]}
                    />
                  </span>
                </Show>
              </span>
            </label>
          )}
        </For>
      </div>
      <Show when={cursor()}>
        <button
          type="button"
          onclick={() => refetch()}
          class="dark:bg-dark-700 dark:hover:bg-dark-800 mt-1 rounded-lg border border-gray-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          Load More
        </button>
      </Show>
    </Show>
  );
};

export { CollectionView };
