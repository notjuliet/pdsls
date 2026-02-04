import * as CAR from "@atcute/car";
import * as CBOR from "@atcute/cbor";
import * as CID from "@atcute/cid";
import { Did } from "@atcute/lexicons";
import { fromStream, isCommit } from "@atcute/repo";
import * as TID from "@atcute/tid";
import { Title } from "@solidjs/meta";
import { useLocation, useNavigate } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Switch,
  untrack,
} from "solid-js";
import { Button } from "../../components/button.jsx";
import { Favicon } from "../../components/favicon.jsx";
import HoverCard from "../../components/hover-card/base";
import { JSONValue } from "../../components/json.jsx";
import { TextInput } from "../../components/text-input.jsx";
import { didDocCache, resolveDidDoc } from "../../utils/api.js";
import { localDateFromTimestamp } from "../../utils/date.js";
import { createDebouncedValue } from "../../utils/hooks/debounced.js";
import { createDropHandler, createFileChangeHandler, handleDragOver } from "./file-handlers.js";
import {
  type Archive,
  type CollectionEntry,
  type RecordEntry,
  type View,
  toJsonValue,
  WelcomeView,
} from "./shared.jsx";

const viewToHash = (view: View): string => {
  switch (view.type) {
    case "repo":
      return "";
    case "collection":
      return `#${view.collection.name}`;
    case "record":
      return `#${view.collection.name}/${view.record.key}`;
  }
};

const hashToView = (hash: string, archive: Archive): View => {
  if (!hash || hash === "#") return { type: "repo" };

  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const slashIdx = raw.indexOf("/");

  if (slashIdx === -1) {
    const collection = archive.entries.find((e) => e.name === raw);
    if (collection) return { type: "collection", collection };
    return { type: "repo" };
  }

  const collectionName = raw.slice(0, slashIdx);
  const recordKey = raw.slice(slashIdx + 1);
  const collection = archive.entries.find((e) => e.name === collectionName);
  if (collection) {
    const record = collection.entries.find((r) => r.key === recordKey);
    if (record) return { type: "record", collection, record };
    return { type: "collection", collection };
  }

  return { type: "repo" };
};

export const ExploreToolView = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [archive, setArchive] = createSignal<Archive | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [progress, setProgress] = createSignal(0);
  const [error, setError] = createSignal<string>();

  const view = createMemo((): View => {
    const arch = archive();
    if (!arch) return { type: "repo" };
    return hashToView(location.hash, arch);
  });

  const navigateToView = (newView: View) => {
    const hash = viewToHash(newView);
    navigate(`${location.pathname}${hash}`);
  };

  const parseCarFile = async (file: File) => {
    setLoading(true);
    setProgress(0);
    setError(undefined);

    try {
      // Read file as ArrayBuffer to extract DID from commit block
      const buffer = new Uint8Array(await file.arrayBuffer());
      const car = CAR.fromUint8Array(buffer);

      // Get DID from commit block
      let did = "Repository";
      const rootCid = car.roots[0]?.$link;
      if (rootCid) {
        for (const entry of car) {
          try {
            if (CID.toString(entry.cid) === rootCid) {
              const commit = CBOR.decode(entry.bytes);
              if (isCommit(commit)) {
                did = commit.did;
              }
              break;
            }
          } catch {
            // Skip entries with invalid CIDs
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
        let count = 0;
        for await (const entry of repo) {
          try {
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

            if (++count % 10000 === 0) {
              setProgress(count);
              await new Promise((resolve) => setTimeout(resolve, 0));
            }
          } catch {
            // Skip entries with invalid data
          }
        }
      } finally {
        await repo.dispose();
      }

      // Resolve DID document to populate handle in cache
      if (did !== "Repository") {
        try {
          const doc = await resolveDidDoc(did as Did);
          didDocCache[did] = doc;
        } catch (err) {
          console.error("Failed to resolve DID document:", err);
        }
      }

      setArchive(result);
      if (location.hash) navigate(location.pathname, { replace: true });
    } catch (err) {
      console.error("Failed to parse CAR file:", err);
      setError(err instanceof Error ? err.message : "Failed to parse CAR file");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = createFileChangeHandler(parseCarFile);
  const handleDrop = createDropHandler(parseCarFile);

  const reset = () => {
    setArchive(null);
    setError(undefined);
    if (location.hash) navigate(location.pathname, { replace: true });
  };

  return (
    <>
      <Title>Explore archive - PDSls</Title>
      <Show
        when={archive()}
        fallback={
          <WelcomeView
            title="Explore archive"
            subtitle="Upload a CAR file to explore its contents."
            loading={loading()}
            progress={progress()}
            error={error()}
            onFileChange={handleFileChange}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          />
        }
      >
        {(arch) => (
          <ExploreView archive={arch()} view={view} setView={navigateToView} onClose={reset} />
        )}
      </Show>
    </>
  );
};

const ExploreView = (props: {
  archive: Archive;
  view: () => View;
  setView: (view: View) => void;
  onClose: () => void;
}) => {
  const handle =
    didDocCache[props.archive.did]?.alsoKnownAs
      ?.filter((alias) => alias.startsWith("at://"))[0]
      ?.split("at://")[1] ?? props.archive.did;

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
                <span class="flex min-w-0 gap-1 py-0.5 font-medium">
                  <Show
                    when={handle !== props.archive.did}
                    fallback={<span class="truncate">{props.archive.did}</span>}
                  >
                    <span class="shrink-0">{handle}</span>
                    <span class="truncate text-neutral-500 dark:text-neutral-400">
                      ({props.archive.did})
                    </span>
                  </Show>
                </span>
              </div>
            }
          >
            <button
              type="button"
              onClick={() => props.setView({ type: "repo" })}
              class="flex min-h-6 min-w-0 basis-full items-center gap-2 px-2 sm:min-h-7"
            >
              <span class="iconify lucide--book-user shrink-0 text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200" />
              <span class="flex min-w-0 gap-1 py-0.5 font-medium text-blue-500 transition-colors duration-150 group-hover:text-blue-600 dark:text-blue-400 dark:group-hover:text-blue-300">
                <Show
                  when={handle !== props.archive.did}
                  fallback={<span class="truncate">{props.archive.did}</span>}
                >
                  <span class="shrink-0">{handle}</span>
                  <span class="truncate">({props.archive.did})</span>
                </Show>
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
                  <span class="truncate py-0.5 font-medium text-blue-500 transition-colors duration-150 group-hover:text-blue-600 dark:text-blue-400 dark:group-hover:text-blue-300">
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
          {(record) => {
            const rkeyTimestamp = createMemo(() => {
              if (!record().key || !TID.validate(record().key)) return undefined;
              const timestamp = TID.parse(record().key).timestamp / 1000;
              return timestamp <= Date.now() ? timestamp : undefined;
            });

            return (
              <div class="group relative flex items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
                <div class="flex min-h-6 min-w-0 basis-full items-center gap-2 sm:min-h-7">
                  <span class="iconify lucide--file-json shrink-0 text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200" />
                  <div class="flex min-w-0 gap-1 py-0.5 font-medium">
                    <span class="shrink-0">{record().key}</span>
                    <Show when={rkeyTimestamp()}>
                      <span class="truncate text-neutral-500 dark:text-neutral-400">
                        ({localDateFromTimestamp(rkeyTimestamp()!)})
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
            );
          }}
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
        {props.archive.entries.length} collection{props.archive.entries.length !== 1 ? "s" : ""}
        <span class="text-neutral-400 dark:text-neutral-600"> · </span>
        {totalRecords()} record{totalRecords() !== 1 ? "s" : ""}
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
            const authority = () => entry.name.split(".").slice(0, 2).join(".");

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
                  class="flex w-full items-center gap-2 rounded p-2 text-left text-sm hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                >
                  <Favicon authority={authority()} />
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
  const debouncedFilter = createDebouncedValue(filter, 150);
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

  const searchableEntries = createMemo(() => {
    return sortedEntries().map((entry) => ({
      entry,
      searchText: JSON.stringify(entry.record).toLowerCase(),
    }));
  });

  const filteredEntries = createMemo(() => {
    const f = debouncedFilter().toLowerCase().trim();
    if (!f) return sortedEntries();
    return searchableEntries()
      .filter(({ searchText }) => searchText.includes(f))
      .map(({ entry }) => entry);
  });

  createEffect(() => {
    debouncedFilter();
    untrack(() => setDisplayCount(RECORDS_PER_PAGE));
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
        {filteredEntries().length} record{filteredEntries().length !== 1 ? "s" : ""}
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
          onInput={(e) => setFilter(e.currentTarget.value)}
          class="grow text-sm"
        />

        <Show when={hasMore()}>
          <span class="text-sm text-neutral-600 dark:text-neutral-400">
            {displayedEntries().length}/{filteredEntries().length}
          </span>

          <Button onClick={loadMore}>Load more</Button>
        </Show>
      </div>

      <div class="flex flex-col font-mono">
        <For each={displayedEntries()}>
          {(entry) => {
            const isTid = TID.validate(entry.key);
            const timestamp = isTid ? TID.parse(entry.key).timestamp / 1_000 : null;

            return (
              <HoverCard
                class="flex w-full items-baseline gap-1 rounded px-1 py-0.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                trigger={
                  <button
                    onClick={() => {
                      props.onRoute({
                        type: "record",
                        collection: props.collection,
                        record: entry,
                      });
                    }}
                    class="flex w-full items-baseline gap-1 text-left"
                  >
                    <span class="max-w-full shrink-0 truncate text-sm text-blue-500 dark:text-blue-400">
                      {entry.key}
                    </span>
                    <span class="truncate text-xs text-neutral-500 dark:text-neutral-400" dir="rtl">
                      {entry.cid}
                    </span>
                    <Show when={timestamp}>
                      {(ts) => (
                        <span class="ml-auto shrink-0 text-xs">{localDateFromTimestamp(ts())}</span>
                      )}
                    </Show>
                  </button>
                }
              >
                <JSONValue data={entry.record} repo={props.archive.did} truncate hideBlobs />
              </HoverCard>
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
          <JSONValue data={props.record.record} repo={props.archive.did || ""} newTab hideBlobs />
        </div>
      </Show>
    </div>
  );
};
