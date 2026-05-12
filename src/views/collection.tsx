import { ComAtprotoRepoApplyWrites, ComAtprotoRepoGetRecord } from "@atcute/atproto";
import { Client } from "@atcute/client";
import { $type, ActorIdentifier, InferXRPCBodyOutput } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import { A, type RouteSectionProps, useParams, useSearchParams } from "@solidjs/router";
import {
  createMemo,
  createResource,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Portal } from "solid-js/web";
import { agent } from "../auth/state";
import { Button } from "../components/button.jsx";
import HoverCard from "../components/hover-card/base";
import { JSONType, JSONValue } from "../components/json.jsx";
import { Modal } from "../components/modal.jsx";
import { NestedLayout } from "../components/nested-layout.jsx";
import { addNotification, removeNotification } from "../components/notification.jsx";
import { PermissionButton } from "../components/permission-button.jsx";
import { Spinner } from "../components/spinner.jsx";
import Tooltip from "../components/tooltip.jsx";
import { createLatch } from "../lib/create-latch.js";
import { useFilterShortcut } from "../lib/keyboard.js";
import { useRepo } from "../lib/repo-context.jsx";
import { SchemaTabContent, useLexiconSchema } from "../lib/schema-tab.jsx";
import { localDateFromTimestamp } from "../utils/date.js";

interface AtprotoRecord {
  rkey: string;
  cid: string;
  record: InferXRPCBodyOutput<ComAtprotoRepoGetRecord.mainSchema["output"]>;
  timestamp: number | undefined;
  toDelete: boolean;
}

const DEFAULT_LIMIT = 100;
const PREVIEW_VALUE_MAX_LENGTH = 200;
const PREVIEW_FIELD_OPTION_MAX_DEPTH = 2;

const getRecordValue = (record: AtprotoRecord) => record.record.value as JSONType;

const isRecordObject = (value: unknown): value is Record<string, JSONType> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const getSearchParam = (param: string | string[] | undefined) =>
  Array.isArray(param) ? param[0] : (param ?? "");

const getPathValue = (value: JSONType, path: string) => {
  let current: JSONType | undefined = value;

  for (const segment of path.split(".")) {
    if (!segment) return;

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return;
      current = current[index];
    } else if (isRecordObject(current)) {
      if (!Object.hasOwn(current, segment)) return;
      current = current[segment];
    } else return;
  }

  return current;
};

const addPreviewFieldOptions = (value: JSONType, fields: Set<string>, path = "", depth = 1) => {
  if (!isRecordObject(value) || depth > PREVIEW_FIELD_OPTION_MAX_DEPTH) return;

  for (const key of Object.keys(value)) {
    if (key === "$type") continue;

    const fieldPath = path ? `${path}.${key}` : key;
    fields.add(fieldPath);
    addPreviewFieldOptions(value[key], fields, fieldPath, depth + 1);
  }
};

const formatPreviewValue = (value: JSONType | undefined) => {
  if (value === undefined) return;

  const str =
    typeof value === "string" ? JSON.stringify(value)
    : typeof value === "number" || typeof value === "boolean" || value === null ? String(value)
    : JSON.stringify(value);

  if (str.length <= PREVIEW_VALUE_MAX_LENGTH) return str;

  return `${str.slice(0, PREVIEW_VALUE_MAX_LENGTH)}...`;
};

const RecordLink = (props: { record: AtprotoRecord; previewField?: string }) => {
  const previewValue = () => {
    const field = props.previewField;
    const value = getRecordValue(props.record);
    if (!field) return;
    return formatPreviewValue(getPathValue(value, field));
  };

  return (
    <HoverCard
      class="flex w-full min-w-0 flex-col rounded px-1 py-0.5"
      trigger={
        <>
          <span class="flex w-full min-w-0 items-baseline">
            <span class="max-w-full shrink-0 truncate text-sm text-blue-500 dark:text-blue-400">
              {props.record.rkey}
            </span>
            <span class="ml-1 truncate text-xs text-neutral-400 dark:text-neutral-500" dir="rtl">
              {props.record.cid}
            </span>
            <Show when={props.record.timestamp && props.record.timestamp <= Date.now()}>
              <span class="ml-1 shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
                {localDateFromTimestamp(props.record.timestamp!)}
              </span>
            </Show>
          </span>
          <Show when={previewValue()}>
            {(preview) => (
              <span class="flex w-full min-w-0 items-baseline gap-1 text-xs">
                <span class="shrink-0 text-neutral-500 dark:text-neutral-400">
                  {props.previewField}:
                </span>
                <span class="min-w-0 truncate">{preview()}</span>
              </span>
            )}
          </Show>
        </>
      }
    >
      <JSONValue
        data={props.record.record.value as JSONType}
        repo={props.record.record.uri.split("/")[2]}
        truncate
        hideBlobs
        preview
      />
    </HoverCard>
  );
};

const PreviewFieldMenu = (props: {
  value: string;
  options: string[];
  onChange: (field: string) => void;
}) => {
  const [open, setOpen] = createSignal(false);
  const [menu, setMenu] = createSignal<HTMLDivElement>();
  const [button, setButton] = createSignal<HTMLButtonElement>();
  const [buttonRect, setButtonRect] = createSignal<DOMRect>();

  const updatePosition = () => {
    const rect = button()?.getBoundingClientRect();
    if (rect) setButtonRect(rect);
  };

  const menuStyle = (): JSX.CSSProperties | undefined => {
    const rect = buttonRect();
    if (!rect) return;

    const menuWidth = Math.min(260, window.innerWidth - 16);
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - menuWidth - 8);

    return {
      position: "fixed",
      top: `${rect.top - 4}px`,
      left: `${left}px`,
      width: `${menuWidth}px`,
      transform: "translateY(-100%)",
    };
  };

  const closeOnOutsideClick = (event: MouseEvent) => {
    const target = event.target as Node;
    if (!button()?.contains(target) && !menu()?.contains(target)) setOpen(false);
  };

  const selectField = (field: string) => {
    props.onChange(field);
    setOpen(false);
  };

  onMount(() => {
    window.addEventListener("click", closeOnOutsideClick);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
  });

  onCleanup(() => {
    window.removeEventListener("click", closeOnOutsideClick);
    window.removeEventListener("scroll", updatePosition, true);
    window.removeEventListener("resize", updatePosition);
  });

  return (
    <>
      <button
        type="button"
        ref={setButton}
        class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 flex max-w-44 min-w-0 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 transition-colors select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300"
        classList={{
          "text-blue-500! dark:text-blue-400! border-blue-500! dark:border-blue-400!":
            !!props.value,
        }}
        onClick={() => {
          updatePosition();
          setOpen(!open());
        }}
      >
        <span class="min-w-0 truncate">{props.value ? `Preview: ${props.value}` : "Preview"}</span>
        <span class="iconify lucide--chevron-down shrink-0 text-[10px]"></span>
      </button>
      <Show when={open()}>
        <Portal>
          <div
            ref={setMenu}
            style={menuStyle()}
            class="dark:bg-dark-300 dark:shadow-dark-700 z-50 flex max-h-80 flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-xs shadow-md dark:border-neutral-700"
          >
            <button
              type="button"
              class="flex items-center gap-2 rounded-md p-1.5 text-left hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
              onClick={() => selectField("")}
            >
              <span
                class="iconify shrink-0"
                classList={{
                  "iconify lucide--check text-blue-500 dark:text-blue-400": !props.value,
                  "lucide--minus text-neutral-400 dark:text-neutral-500": !!props.value,
                }}
              ></span>
              <span>None</span>
            </button>
            <Show when={props.options.length}>
              <div class="my-1 h-[0.5px] bg-neutral-300 dark:bg-neutral-600" />
              <div class="flex max-h-42 flex-col overflow-y-auto">
                <For each={props.options}>
                  {(field) => (
                    <button
                      type="button"
                      class="flex items-center gap-2 rounded-md p-1.5 text-left hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                      onClick={() => selectField(field)}
                    >
                      <span
                        class="iconify shrink-0"
                        classList={{
                          "lucide--check text-blue-500 dark:text-blue-400": props.value === field,
                          "lucide--minus text-transparent": props.value !== field,
                        }}
                      ></span>
                      <span class="min-w-0 truncate">{field}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
            <input
              type="text"
              spellcheck={false}
              autocapitalize="off"
              autocomplete="off"
              class="dark:bg-dark-100 mt-2 rounded-md bg-white px-2 py-1 outline-1 outline-neutral-200 select-none placeholder:font-sans placeholder:text-xs focus:outline-neutral-400 dark:outline-neutral-600 dark:focus:outline-neutral-400"
              placeholder="custom path"
              value={props.value}
              onInput={(e) => props.onChange(e.currentTarget.value)}
            />
          </div>
        </Portal>
      </Show>
    </>
  );
};

export const CollectionLayout = (props: RouteSectionProps) => {
  const params = useParams();
  const hasChild = () => !!params.rkey;
  return (
    <NestedLayout
      key={`${params.repo}/${params.collection}`}
      hasChild={hasChild()}
      view={() => <CollectionView />}
    >
      {props.children}
    </NestedLayout>
  );
};

const CollectionView = () => {
  const repo = useRepo();
  const params = useParams();
  const hidden = () => !!params.rkey;
  const [searchParams, setSearchParams] = useSearchParams();
  const [cursor, setCursor] = createSignal<string>();
  const [records, setRecords] = createStore<AtprotoRecord[]>([]);
  const [filter, setFilter] = createSignal<string>();
  const [batchDelete, setBatchDelete] = createSignal(false);
  const [lastSelected, setLastSelected] = createSignal<number>();
  const [reverse, setReverse] = createSignal(searchParams.reverse === "true");
  const previewField = () => getSearchParam(searchParams.preview);
  const limit = () => {
    const limitParam =
      Array.isArray(searchParams.limit) ? searchParams.limit[0] : searchParams.limit;
    const paramLimit = parseInt(limitParam || "");
    return !isNaN(paramLimit) && paramLimit > 0 && paramLimit <= 100 ? paramLimit : DEFAULT_LIMIT;
  };
  const [recreate, setRecreate] = createSignal(false);
  const [openDelete, setOpenDelete] = createSignal(false);
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);
  const did = repo.did();
  const lexicon = useLexiconSchema(() => (hidden() ? undefined : params.collection));

  let filterInputRef: HTMLInputElement | undefined;

  onMount(() => {
    useFilterShortcut(() => filterInputRef);
  });

  const fetchRecords = async () => {
    const rpc = repo.rpc()!;
    const collection = params.collection!;
    const isLoadMore = isLoadingMore();
    setIsLoadingMore(false);

    const res = await rpc.get("com.atproto.repo.listRecords", {
      params: {
        repo: did as ActorIdentifier,
        collection: collection as `${string}.${string}.${string}`,
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

  const shouldFetch = createLatch(() => !hidden() && !!repo.rpc());

  const [response, { refetch }] = createResource(shouldFetch, fetchRecords);

  const filteredRecords = createMemo(() =>
    records.filter((rec) =>
      filter() ? JSON.stringify(rec.record.value).includes(filter()!) : true,
    ),
  );

  const previewFieldOptions = createMemo(() => {
    const fields = new Set<string>();

    for (const record of records) {
      addPreviewFieldOptions(getRecordValue(record), fields);
    }

    return [...fields].sort((a, b) => a.localeCompare(b));
  });

  const updatePreviewField = (field: string) => {
    const nextField = field.trim();
    setSearchParams({ preview: nextField || undefined }, { replace: true });
  };

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
    const authRpc = new Client({ handler: agent()! });
    for (let i = 0; i < writes.length; i += BATCHSIZE) {
      await authRpc.post("com.atproto.repo.applyWrites", {
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

  if (!hidden()) document.title = `${params.collection} - PDSls`;

  return (
    <>
      <Show
        when={!hidden() && !records.length && (response.state === "unresolved" || response.loading)}
      >
        <Spinner />
      </Show>
      <Show when={!hidden() && (records.length || response.state === "ready")}>
        <div class="flex w-full flex-col items-center">
          {/* Tab bar */}
          <div class="mb-2 flex min-h-7 w-full items-center justify-between px-2 text-sm sm:text-base">
            <div class="flex gap-3 sm:gap-4">
              <A
                href={`/at://${did}/${params.collection}`}
                classList={{
                  "border-b-2 font-medium transition-colors": true,
                  "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
                    lexicon.showSchema(),
                }}
              >
                Records
              </A>
              <A
                href={`/at://${did}/${params.collection}#schema`}
                classList={{
                  "border-b-2 font-medium transition-colors": true,
                  "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
                    !lexicon.showSchema(),
                }}
              >
                Schema
              </A>
              <A
                href={`/jetstream?collections=${params.collection}&dids=${params.repo}`}
                class="border-b-2 border-transparent font-medium transition-colors not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80"
              >
                Jetstream
              </A>
            </div>
            <Show when={!lexicon.showSchema() && agent() && agent()?.sub === did}>
              <div class="flex items-center text-sm sm:gap-1">
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
                  class="flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-0.75 transition-colors hover:bg-neutral-200/50 active:bg-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                  disabledClass="flex items-center gap-1 rounded-md px-2 py-1 opacity-40"
                  onClick={() => {
                    setRecords({ from: 0, to: records.length - 1 }, "toDelete", false);
                    setLastSelected(undefined);
                    setBatchDelete(!batchDelete());
                  }}
                >
                  {batchDelete() ? "Cancel" : "Manage"}
                </PermissionButton>
              </div>
            </Show>
          </div>

          {/* Schema view */}
          <Show when={lexicon.showSchema()}>
            <SchemaTabContent
              schema={lexicon.schema()}
              authority={lexicon.authority()}
              loading={lexicon.loading()}
              error={lexicon.error()}
            />
          </Show>

          {/* Record list */}
          <Show when={!lexicon.showSchema()}>
            <div class="flex w-full max-w-full flex-col px-1 pb-32 font-mono">
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
                            <RecordLink record={record} previewField={previewField()} />
                          </div>
                        </Show>
                        <Show when={!batchDelete()}>
                          <A
                            href={`/at://${did}/${params.collection}/${record.rkey}`}
                            class="rounded select-none hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                          >
                            <RecordLink record={record} previewField={previewField()} />
                          </A>
                        </Show>
                      </>
                    );
                  }}
                </For>
              </Show>
            </div>
          </Show>
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
        <Show when={!lexicon.showSchema() && records.length > 1}>
          <div class="bottom-controls-fade dark:bg-dark-500 fixed bottom-0 z-10 flex w-full flex-col items-center gap-2 bg-neutral-100 px-3 pt-3 pb-6">
            <div class="flex w-full max-w-lg items-center gap-2">
              {/* Filter */}
              <div
                class="dark:bg-dark-200 flex min-w-0 grow cursor-text items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 text-sm dark:border-neutral-700"
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
                  class="min-w-0 grow py-1 select-none placeholder:text-xs focus:outline-none"
                  placeholder="Filter records..."
                  onInput={(e) => setFilter(e.currentTarget.value)}
                />
              </div>
              <PreviewFieldMenu
                value={previewField()}
                options={previewFieldOptions()}
                onChange={updatePreviewField}
              />
            </div>

            {/* Pagination */}
            <div class="flex min-h-7.5 w-full max-w-lg items-center justify-between gap-2">
              <Button
                onClick={() => {
                  const newReverse = !reverse();
                  setReverse(newReverse);
                  setSearchParams({ reverse: newReverse ? "true" : undefined });
                  setCursor(undefined);
                  setRecords([]);
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
              <div class="shrink-0 text-sm">
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
                    onClick={() => {
                      setIsLoadingMore(true);
                      refetch();
                    }}
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
