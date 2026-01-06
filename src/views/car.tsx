import * as CAR from "@atcute/car";
import * as CBOR from "@atcute/cbor";
import * as CID from "@atcute/cid";
import { fromStream, isCommit } from "@atcute/repo";
import * as TID from "@atcute/tid";
import { Title } from "@solidjs/meta";
import { createEffect, createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { Button } from "../components/button.jsx";
import { JSONValue, type JSONType } from "../components/json.jsx";
import { TextInput } from "../components/text-input.jsx";
import { isTouchDevice } from "../layout.jsx";
import { localDateFromTimestamp } from "../utils/date.js";

// Convert CBOR-decoded objects to JSON-friendly format
const toJsonValue = (obj: unknown): JSONType => {
  if (obj === null || obj === undefined) return null;

  if (CID.isCidLink(obj)) {
    return { $link: obj.$link };
  }

  if (
    obj &&
    typeof obj === "object" &&
    "version" in obj &&
    "codec" in obj &&
    "digest" in obj &&
    "bytes" in obj
  ) {
    try {
      return { $link: CID.toString(obj as CID.Cid) };
    } catch {}
  }

  if (CBOR.isBytes(obj)) {
    return { $bytes: obj.$bytes };
  }

  if (Array.isArray(obj)) {
    return obj.map(toJsonValue);
  }

  if (typeof obj === "object") {
    const result: Record<string, JSONType> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = toJsonValue(value);
    }
    return result;
  }

  return obj as JSONType;
};

interface Archive {
  file: File;
  did: string;
  entries: CollectionEntry[];
}

interface CollectionEntry {
  name: string;
  entries: RecordEntry[];
}

interface RecordEntry {
  key: string;
  cid: string;
  record: JSONType;
}

type View =
  | { type: "repo" }
  | { type: "collection"; collection: CollectionEntry }
  | { type: "record"; collection: CollectionEntry; record: RecordEntry };

export const CarView = () => {
  const [archive, setArchive] = createSignal<Archive | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [view, setView] = createSignal<View>({ type: "repo" });

  const parseCarFile = async (file: File) => {
    setLoading(true);
    setError(undefined);

    try {
      // Read file as ArrayBuffer to extract DID from commit block
      const buffer = new Uint8Array(await file.arrayBuffer());
      const car = CAR.fromUint8Array(buffer);

      // Get DID from commit block
      let did = "";
      const rootCid = car.roots[0]?.$link;
      if (rootCid) {
        for (const entry of car) {
          if (CID.toString(entry.cid) === rootCid) {
            const commit = CBOR.decode(entry.bytes);
            if (isCommit(commit)) {
              did = commit.did;
            }
            break;
          }
        }
      }

      const collections = new Map<string, RecordEntry[]>();
      const result: Archive = {
        file,
        did,
        entries: [],
      };

      const stream = file.stream();
      const repo = fromStream(stream);
      try {
        for await (const entry of repo) {
          let list = collections.get(entry.collection);
          if (list === undefined) {
            collections.set(entry.collection, (list = []));
            result.entries.push({
              name: entry.collection,
              entries: list,
            });
          }

          const record = toJsonValue(entry.record);
          list.push({
            key: entry.rkey,
            cid: entry.cid.$link,
            record,
          });
        }
      } finally {
        await repo.dispose();
      }

      setArchive(result);
      setView({ type: "repo" });
    } catch (err) {
      console.error("Failed to parse CAR file:", err);
      setError(err instanceof Error ? err.message : "Failed to parse CAR file");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      parseCarFile(file);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith(".car") || file.type === "application/vnd.ipld.car")) {
      parseCarFile(file);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const reset = () => {
    setArchive(null);
    setView({ type: "repo" });
    setError(undefined);
  };

  return (
    <>
      <Title>CAR explorer - PDSls</Title>
      <div class="flex w-full flex-col items-center">
        <Show
          when={archive()}
          fallback={
            <WelcomeView
              loading={loading()}
              error={error()}
              onFileChange={handleFileChange}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            />
          }
        >
          {(arch) => <ExploreView archive={arch()} view={view} setView={setView} onClose={reset} />}
        </Show>
      </div>
    </>
  );
};

const WelcomeView = (props: {
  loading: boolean;
  error?: string;
  onFileChange: (e: Event) => void;
  onDrop: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
}) => {
  return (
    <div class="flex w-full max-w-3xl flex-col gap-y-4 px-2">
      <div class="flex flex-col gap-y-1">
        <h1 class="text-lg font-semibold">CAR explorer</h1>
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          Upload a CAR (Content Addressable aRchive) file to explore its contents.
        </p>
      </div>

      <div
        class="dark:bg-dark-300 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 transition-colors hover:border-neutral-400 dark:border-neutral-600 dark:hover:border-neutral-500"
        onDrop={props.onDrop}
        onDragOver={props.onDragOver}
      >
        <Show
          when={!props.loading}
          fallback={
            <div class="flex flex-col items-center gap-2">
              <span class="iconify lucide--loader-circle animate-spin text-3xl text-neutral-400" />
              <span class="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Reading CAR file...
              </span>
            </div>
          }
        >
          <span class="iconify lucide--folder-archive text-3xl text-neutral-400" />
          <div class="text-center">
            <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Drag and drop a CAR file here
            </p>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">or</p>
          </div>
          <label class="dark:hover:bg-dark-200 dark:shadow-dark-700 dark:active:bg-dark-100 box-border flex h-8 items-center justify-center gap-1 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 px-3 py-1.5 text-sm shadow-xs select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800">
            <input
              type="file"
              accept=".car,application/vnd.ipld.car"
              onChange={props.onFileChange}
              class="hidden"
            />
            <span class="iconify lucide--upload text-sm" />
            Choose file
          </label>
        </Show>
      </div>

      <Show when={props.error}>
        <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {props.error}
        </div>
      </Show>
    </div>
  );
};

const ExploreView = (props: {
  archive: Archive;
  view: () => View;
  setView: (view: View) => void;
  onClose: () => void;
}) => {
  return (
    <div class="flex w-full flex-col">
      <nav class="flex w-full flex-col text-sm wrap-anywhere sm:text-base">
        {/* DID / Repository Level */}
        <div class="group relative flex items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
          <Show
            when={props.view().type !== "repo"}
            fallback={
              <div class="flex min-h-6 min-w-0 basis-full items-center gap-2 px-2 sm:min-h-7">
                <span class="iconify lucide--book-user shrink-0 text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200" />
                <span class="truncate py-0.5 font-medium">{props.archive.did || "Repository"}</span>
              </div>
            }
          >
            <button
              type="button"
              onClick={() => props.setView({ type: "repo" })}
              class="flex min-h-6 min-w-0 basis-full items-center gap-2 px-2 sm:min-h-7"
            >
              <span class="iconify lucide--book-user shrink-0 text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200" />
              <span class="truncate py-0.5 font-medium text-blue-400 transition-colors duration-150 group-hover:text-blue-500 dark:group-hover:text-blue-300">
                {props.archive.did || "Repository"}
              </span>
            </button>
          </Show>
          <button
            type="button"
            onClick={props.onClose}
            title="Close and upload a different file"
            class="flex shrink-0 items-center rounded px-2 py-1 text-neutral-500 transition-all duration-200 hover:bg-neutral-200/70 hover:text-neutral-600 active:bg-neutral-300/70 sm:py-1.5 dark:text-neutral-400 dark:hover:bg-neutral-700/70 dark:hover:text-neutral-300 dark:active:bg-neutral-600/70"
          >
            <span class="iconify lucide--x" />
          </button>
        </div>

        {/* Collection Level */}
        <Show
          when={(() => {
            const v = props.view();
            return v.type === "collection" || v.type === "record" ? v.collection : null;
          })()}
        >
          {(collection) => (
            <Show
              when={props.view().type === "record"}
              fallback={
                <div class="group relative flex items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
                  <div class="flex min-h-6 min-w-0 basis-full items-center gap-2 sm:min-h-7">
                    <span class="iconify lucide--folder-open shrink-0 text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200" />
                    <span class="truncate py-0.5 font-medium">{collection().name}</span>
                  </div>
                </div>
              }
            >
              <button
                type="button"
                onClick={() => props.setView({ type: "collection", collection: collection() })}
                class="group relative flex w-full items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40"
              >
                <div class="flex min-h-6 min-w-0 basis-full items-center gap-2 sm:min-h-7">
                  <span class="iconify lucide--folder-open shrink-0 text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200" />
                  <span class="truncate py-0.5 font-medium text-blue-400 transition-colors duration-150 group-hover:text-blue-500 dark:group-hover:text-blue-300">
                    {collection().name}
                  </span>
                </div>
              </button>
            </Show>
          )}
        </Show>

        {/* Record Level */}
        <Show
          when={(() => {
            const v = props.view();
            return v.type === "record" ? v.record : null;
          })()}
        >
          {(record) => (
            <div class="group relative flex items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
              <div class="flex min-h-6 min-w-0 basis-full items-center gap-2 sm:min-h-7">
                <span class="iconify lucide--file-json shrink-0 text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200" />
                <span class="truncate py-0.5 font-medium">{record().key}</span>
              </div>
            </div>
          )}
        </Show>
      </nav>

      <div class="px-2 py-2">
        <Switch>
          <Match when={props.view().type === "repo"}>
            <RepoSubview archive={props.archive} onRoute={props.setView} />
          </Match>

          <Match
            when={(() => {
              const v = props.view();
              return v.type === "collection" ? v : null;
            })()}
            keyed
          >
            {({ collection }) => (
              <CollectionSubview
                archive={props.archive}
                collection={collection}
                onRoute={props.setView}
              />
            )}
          </Match>

          <Match
            when={(() => {
              const v = props.view();
              return v.type === "record" ? v : null;
            })()}
            keyed
          >
            {({ collection, record }) => (
              <RecordSubview archive={props.archive} collection={collection} record={record} />
            )}
          </Match>
        </Switch>
      </div>
    </div>
  );
};

const RepoSubview = (props: { archive: Archive; onRoute: (view: View) => void }) => {
  const [filter, setFilter] = createSignal("");

  const sortedEntries = createMemo(() => {
    return [...props.archive.entries].sort((a, b) => a.name.localeCompare(b.name));
  });

  const filteredEntries = createMemo(() => {
    const f = filter().toLowerCase().trim();
    if (!f) return sortedEntries();
    return sortedEntries().filter((entry) => entry.name.toLowerCase().includes(f));
  });

  const totalRecords = createMemo(() =>
    props.archive.entries.reduce((sum, entry) => sum + entry.entries.length, 0),
  );

  return (
    <div class="flex flex-col gap-3">
      <div class="text-sm text-neutral-600 dark:text-neutral-400">
        {props.archive.entries.length} collection{props.archive.entries.length > 1 ? "s" : ""}
        <span class="text-neutral-400 dark:text-neutral-600"> · </span>
        {totalRecords()} record{totalRecords() > 1 ? "s" : ""}
      </div>

      <TextInput
        placeholder="Filter collections"
        value={filter()}
        onInput={(e) => setFilter(e.currentTarget.value)}
        class="text-sm"
      />

      <ul class="flex flex-col">
        <For each={filteredEntries()}>
          {(entry) => {
            const hasSingleEntry = entry.entries.length === 1;

            return (
              <li>
                <button
                  onClick={() => {
                    if (hasSingleEntry) {
                      props.onRoute({
                        type: "record",
                        collection: entry,
                        record: entry.entries[0],
                      });
                    } else {
                      props.onRoute({ type: "collection", collection: entry });
                    }
                  }}
                  class="flex w-full items-center gap-2 rounded p-2 text-left text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  <span
                    class="truncate font-medium"
                    classList={{
                      "text-neutral-700 dark:text-neutral-300": hasSingleEntry,
                      "text-blue-500 dark:text-blue-400": !hasSingleEntry,
                    }}
                  >
                    {entry.name}
                  </span>

                  <Show when={hasSingleEntry}>
                    <span class="iconify lucide--chevron-right shrink-0 text-xs text-neutral-500" />
                    <span class="truncate font-medium text-blue-500 dark:text-blue-400">
                      {entry.entries[0].key}
                    </span>
                  </Show>

                  <Show when={!hasSingleEntry}>
                    <span class="ml-auto text-xs text-neutral-500">{entry.entries.length}</span>
                  </Show>
                </button>
              </li>
            );
          }}
        </For>
      </ul>

      <Show when={filteredEntries().length === 0 && filter()}>
        <div class="flex flex-col items-center justify-center py-8 text-center">
          <span class="iconify lucide--search-x mb-2 text-3xl text-neutral-400" />
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            No collections match your filter
          </p>
        </div>
      </Show>
    </div>
  );
};

const RECORDS_PER_PAGE = 100;

const CollectionSubview = (props: {
  archive: Archive;
  collection: CollectionEntry;
  onRoute: (view: View) => void;
}) => {
  const [filter, setFilter] = createSignal("");
  const [displayCount, setDisplayCount] = createSignal(RECORDS_PER_PAGE);

  // Sort entries by TID timestamp (most recent first), non-TID entries go to the end
  const sortedEntries = createMemo(() => {
    return [...props.collection.entries].sort((a, b) => {
      const aIsTid = TID.validate(a.key);
      const bIsTid = TID.validate(b.key);

      if (aIsTid && bIsTid) {
        return TID.parse(b.key).timestamp - TID.parse(a.key).timestamp;
      }
      if (aIsTid) return -1;
      if (bIsTid) return 1;
      return b.key.localeCompare(a.key);
    });
  });

  const filteredEntries = createMemo(() => {
    const f = filter().toLowerCase().trim();
    if (!f) return sortedEntries();
    return sortedEntries().filter((entry) =>
      JSON.stringify(entry.record).toLowerCase().includes(f),
    );
  });

  const displayedEntries = createMemo(() => {
    return filteredEntries().slice(0, displayCount());
  });

  const hasMore = createMemo(() => filteredEntries().length > displayCount());

  const loadMore = () => {
    setDisplayCount((prev) => prev + RECORDS_PER_PAGE);
  };

  return (
    <div class="flex flex-col gap-3">
      <span class="text-sm text-neutral-600 dark:text-neutral-400">
        {filteredEntries().length} record{filteredEntries().length > 1 ? "s" : ""}
        {filter() && filteredEntries().length !== props.collection.entries.length && (
          <span class="text-neutral-400 dark:text-neutral-500">
            {" "}
            (of {props.collection.entries.length})
          </span>
        )}
      </span>

      <div class="flex items-center gap-2">
        <TextInput
          placeholder="Filter records"
          value={filter()}
          onInput={(e) => {
            setFilter(e.currentTarget.value);
            setDisplayCount(RECORDS_PER_PAGE);
          }}
          class="grow text-sm"
        />

        <Show when={hasMore()}>
          <span class="text-sm text-neutral-600 dark:text-neutral-400">
            {displayedEntries().length}/{filteredEntries().length}
          </span>

          <Button onClick={loadMore}>Load More</Button>
        </Show>
      </div>

      <div class="flex flex-col font-mono">
        <For each={displayedEntries()}>
          {(entry) => {
            const isTid = TID.validate(entry.key);
            const timestamp = isTid ? TID.parse(entry.key).timestamp / 1_000 : null;
            const [hover, setHover] = createSignal(false);
            const [previewHeight, setPreviewHeight] = createSignal(0);
            let rkeyRef!: HTMLButtonElement;
            let previewRef!: HTMLSpanElement;

            createEffect(() => {
              if (hover()) setPreviewHeight(previewRef.offsetHeight);
            });

            const isOverflowing = (previewHeight: number) =>
              rkeyRef.offsetTop - window.scrollY + previewHeight + 32 > window.innerHeight;

            return (
              <button
                onClick={() => {
                  props.onRoute({
                    type: "record",
                    collection: props.collection,
                    record: entry,
                  });
                }}
                ref={rkeyRef}
                onmouseover={() => !isTouchDevice && setHover(true)}
                onmouseleave={() => !isTouchDevice && setHover(false)}
                class="relative flex w-full items-baseline gap-1 rounded px-1 py-0.5 text-left hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
              >
                <span class="shrink-0 text-sm text-blue-400">{entry.key}</span>
                <span class="truncate text-xs text-neutral-500 dark:text-neutral-400" dir="rtl">
                  {entry.cid}
                </span>
                <Show when={timestamp}>
                  {(ts) => (
                    <span class="ml-auto shrink-0 text-xs">{localDateFromTimestamp(ts())}</span>
                  )}
                </Show>
                <Show when={hover()}>
                  <span
                    ref={previewRef}
                    class={`dark:bg-dark-300 dark:shadow-dark-700 pointer-events-none absolute left-[50%] z-25 block max-h-80 w-max max-w-sm -translate-x-1/2 overflow-hidden rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-xs whitespace-pre-wrap shadow-md sm:max-h-112 lg:max-w-lg dark:border-neutral-700 ${isOverflowing(previewHeight()) ? "bottom-7" : "top-7"}`}
                  >
                    <JSONValue data={entry.record} repo={props.archive.did} truncate />
                  </span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      <Show when={filteredEntries().length === 0 && filter()}>
        <div class="flex flex-col items-center justify-center py-8 text-center">
          <span class="iconify lucide--search-x mb-2 text-3xl text-neutral-400" />
          <p class="text-sm text-neutral-600 dark:text-neutral-400">No records match your filter</p>
        </div>
      </Show>
    </div>
  );
};

const RecordSubview = (props: {
  archive: Archive;
  collection: CollectionEntry;
  record: RecordEntry;
}) => {
  return (
    <div class="flex flex-col items-center gap-3">
      <div class="flex w-full items-center gap-2 text-sm text-neutral-600 sm:text-base dark:text-neutral-400">
        <span class="iconify lucide--box shrink-0" />
        <span class="text-xs break-all">{props.record.cid}</span>
      </div>

      <Show
        when={props.record.record !== null}
        fallback={
          <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            Failed to decode record
          </div>
        }
      >
        <div class="max-w-full min-w-full font-mono text-xs wrap-anywhere whitespace-pre-wrap sm:w-max sm:max-w-screen sm:px-4 sm:text-sm md:max-w-3xl">
          <JSONValue data={props.record.record} repo={props.archive.did || ""} newTab />
        </div>
      </Show>
    </div>
  );
};
