import * as CAR from "@atcute/car";
import * as CBOR from "@atcute/cbor";
import * as CID from "@atcute/cid";
import { Did } from "@atcute/lexicons";
import { fromStream, isCommit } from "@atcute/repo";
import * as TID from "@atcute/tid";
import { zip, type ZipEntry } from "@mary/zip";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, Match, Show, Switch } from "solid-js";

import { CollectionList } from "../../components/collection-list.jsx";
import { CollectionPage, type CollectionSource } from "../../components/collection-page.jsx";
import { CopyMenu, DropdownMenu, MenuProvider } from "../../components/dropdown.jsx";
import { JSONValue, type JSONType } from "../../components/json.jsx";
import {
  RecordInfo,
  RecordPage,
  recordTabFromHash,
  useRecordSchemaValidation,
} from "../../components/record-page.jsx";
import { Spinner } from "../../components/spinner.jsx";
import { EmptyState, ErrorNotice } from "../../components/states.jsx";
import { TextInput } from "../../components/text-input.jsx";
import { didDocCache, resolveDidDoc } from "../../lib/api.js";
import { SchemaTabContent, useLexiconSchema } from "../../lib/schema-tab.jsx";
import { localDateFromTimestamp } from "../../utils/format.js";
import { carFileAccept, createFileChangeHandler, isIOS } from "./file-handlers.js";
import { clearQueuedCarFile, queuedCarFile } from "./state.js";

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

const WelcomeView = (props: {
  title: string;
  subtitle: string;
  loading: boolean;
  progress?: number;
  error?: string;
  onFileChange: (e: Event) => void;
}) => {
  return (
    <div class="flex w-full max-w-3xl flex-col gap-y-4 px-2">
      <div class="flex flex-col gap-y-1">
        <div class="flex items-center gap-2 text-lg">
          <h1 class="font-semibold">{props.title}</h1>
        </div>
        <p class="text-sm text-neutral-600 dark:text-neutral-400">{props.subtitle}</p>
      </div>

      <div class="dark:bg-dark-300 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 transition-colors hover:border-neutral-400 dark:border-neutral-600 dark:hover:border-neutral-500">
        <Show
          when={!props.loading}
          fallback={
            <div class="flex flex-col items-center gap-2">
              <Spinner class="text-3xl text-neutral-400" />
              <span class="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Reading CAR file...
              </span>
              <Show when={props.progress && props.progress > 0}>
                <span class="text-xs text-neutral-500 dark:text-neutral-400">
                  {props.progress?.toLocaleString()} records processed
                </span>
              </Show>
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
          <label class="dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 flex items-center gap-1 rounded-md border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-sm text-neutral-700 transition-colors select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300">
            <input
              type="file"
              accept={carFileAccept}
              onChange={props.onFileChange}
              class="hidden"
            />
            <span class="iconify lucide--upload text-sm" />
            Choose file
          </label>
        </Show>
      </div>

      <Show when={props.error}>{(message) => <ErrorNotice message={message()} />}</Show>
    </div>
  );
};

const viewToPath = (view: View): string => {
  switch (view.type) {
    case "repo":
      return "/car";
    case "collection":
      return `/car/${view.collection.name}`;
    case "record":
      return `/car/${view.collection.name}/${view.record.key}`;
  }
};

/** Resolves `/car/<collection>/<rkey>` against the loaded archive, falling back to the nearest level. */
const pathToView = (
  collectionName: string | undefined,
  recordKey: string | undefined,
  archive: Archive,
): View => {
  const collection = archive.entries.find((e) => e.name === collectionName);
  if (!collection) return { type: "repo" };

  const record = recordKey ? collection.entries.find((r) => r.key === recordKey) : undefined;
  if (record) return { type: "record", collection, record };
  return { type: "collection", collection };
};

// Check if browser natively supports File System Access API
const hasNativeFileSystemAccess = "showSaveFilePicker" in window;

// HACK: Disable compression on WebKit due to an error being thrown
const isWebKit =
  isIOS || (/AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent));

const INVALID_CHAR_RE = /[<>:"/\\|?*\x00-\x1F]/g;
const filenamify = (name: string) => {
  return name.replace(INVALID_CHAR_RE, "~");
};

export const CarView = () => {
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const initialQueuedFile = queuedCarFile();

  const [archive, setArchive] = createSignal<Archive | null>(null);
  const [loading, setLoading] = createSignal(Boolean(initialQueuedFile));
  const [progress, setProgress] = createSignal(0);
  const [error, setError] = createSignal<string>();

  const view = createMemo((): View => {
    const arch = archive();
    if (!arch) return { type: "repo" };
    return pathToView(params.collection, params.rkey, arch);
  });

  const navigateToView = (newView: View) => {
    navigate(viewToPath(newView));
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
      if (location.pathname !== "/car" || location.hash) navigate("/car", { replace: true });
    } catch (err) {
      console.error("Failed to parse CAR file:", err);
      setError(err instanceof Error ? err.message : "Failed to parse CAR file");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = createFileChangeHandler(parseCarFile);

  createEffect(() => {
    const file = queuedCarFile();
    if (file) {
      clearQueuedCarFile(file);
      void parseCarFile(file);
    }
  });

  const reset = () => {
    setArchive(null);
    setError(undefined);
    if (location.pathname !== "/car" || location.hash) navigate("/car", { replace: true });
  };

  document.title = "CAR explorer - PDSls";
  return (
    <>
      <Show
        when={archive()}
        fallback={
          <WelcomeView
            title="CAR explorer"
            subtitle="Upload an archive to explore or export its contents."
            loading={loading()}
            progress={progress()}
            error={error()}
            onFileChange={handleFileChange}
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

const exportToZip = async (
  archive: Archive,
  onProgress: (count: number) => void,
  onSaving: () => void,
) => {
  const filename = archive.file.name.replace(/\.car$/, "");

  const entryGenerator = async function* (): AsyncGenerator<ZipEntry> {
    let count = 0;
    for (const collection of archive.entries) {
      for (const record of collection.entries) {
        const path = `${collection.name}/${filenamify(record.key)}.json`;
        const data = JSON.stringify(record.record, null, 2);
        yield { filename: path, data, compress: isWebKit ? false : "deflate" };
        if (++count % 500 === 0) {
          onProgress(count);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }
    }
    onProgress(count);
  };

  if (hasNativeFileSystemAccess) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = await (window as any)
      .showSaveFilePicker({
        suggestedName: `${filename}.zip`,
        id: "car-unpack",
        startIn: "downloads",
        types: [
          {
            description: "ZIP archive",
            accept: { "application/zip": [".zip"] },
          },
        ],
      })
      .catch(() => undefined);

    if (!fd) return;

    const writable = await fd.createWritable();
    if (!writable) return;

    let writeCount = 0;
    for await (const chunk of zip(entryGenerator())) {
      writeCount++;
      if (writeCount % 100 === 0) {
        await writable.write(chunk as BufferSource);
      } else {
        writable.write(chunk as BufferSource);
      }
    }

    onSaving();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await writable.close();
  } else {
    const chunks: BlobPart[] = [];
    for await (const chunk of zip(entryGenerator())) {
      chunks.push(chunk as BlobPart);
    }

    onSaving();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const blob = new Blob(chunks, { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

const ExploreView = (props: {
  archive: Archive;
  view: () => View;
  setView: (view: View) => void;
  onClose: () => void;
}) => {
  const [exporting, setExporting] = createSignal(false);
  const [exportCount, setExportCount] = createSignal(0);
  const [exportSaving, setExportSaving] = createSignal(false);

  const totalRecords = createMemo(() =>
    props.archive.entries.reduce((sum, entry) => sum + entry.entries.length, 0),
  );

  const handleExport = async () => {
    setExporting(true);
    setExportCount(0);
    setExportSaving(false);
    try {
      await exportToZip(props.archive, setExportCount, () => {
        setExportSaving(true);
      });
    } finally {
      setExporting(false);
      setExportSaving(false);
    }
  };

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
                <span class="flex min-w-0 items-baseline gap-2 py-0.5 font-medium">
                  <Show
                    when={handle !== props.archive.did}
                    fallback={<span class="truncate">{props.archive.did}</span>}
                  >
                    <span class="shrink-0">{handle}</span>
                    <span class="truncate text-xs font-normal text-neutral-500 sm:text-sm dark:text-neutral-400">
                      {props.archive.did}
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
              <span class="flex min-w-0 items-baseline gap-2 py-0.5 font-medium text-blue-500 transition-colors duration-150 group-hover:text-blue-600 dark:text-blue-400 dark:group-hover:text-blue-300">
                <Show
                  when={handle !== props.archive.did}
                  fallback={<span class="truncate">{props.archive.did}</span>}
                >
                  <span class="shrink-0">{handle}</span>
                  <span class="truncate text-xs font-normal text-neutral-500 sm:text-sm dark:text-neutral-400">
                    {props.archive.did}
                  </span>
                </Show>
              </span>
            </button>
          </Show>
          <div class="flex shrink-0 items-center gap-0.5">
            <Show
              when={exporting()}
              fallback={
                <button
                  type="button"
                  onClick={handleExport}
                  class="flex shrink-0 items-center rounded px-2 py-1 text-xs text-neutral-500 transition-all duration-200 hover:bg-neutral-200/70 hover:text-neutral-600 active:bg-neutral-300/70 sm:py-1.5 dark:text-neutral-400 dark:hover:bg-neutral-700/70 dark:hover:text-neutral-300 dark:active:bg-neutral-600/70"
                >
                  Export ZIP
                </button>
              }
            >
              <div class="flex items-center gap-2 px-2 py-1 sm:py-1.5">
                <Spinner class="text-neutral-400" />
                <span class="w-[4ch] text-right text-xs text-neutral-500 dark:text-neutral-400">
                  {exportSaving() ? "" : `${Math.round((exportCount() / totalRecords()) * 100)}%`}
                </span>
              </div>
            </Show>
            <button
              type="button"
              onClick={props.onClose}
              class="flex shrink-0 items-center rounded px-2 py-1 text-neutral-500 transition-all duration-200 hover:bg-neutral-200/70 hover:text-neutral-600 active:bg-neutral-300/70 sm:py-1.5 dark:text-neutral-400 dark:hover:bg-neutral-700/70 dark:hover:text-neutral-300 dark:active:bg-neutral-600/70"
            >
              <span class="iconify lucide--x" />
            </button>
          </div>
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
                  <div class="flex min-w-0 items-baseline gap-2 py-0.5 font-medium">
                    <span class="shrink-0">{record().key}</span>
                    <Show when={rkeyTimestamp()}>
                      <span class="truncate text-xs font-normal text-neutral-500 sm:text-sm dark:text-neutral-400">
                        {localDateFromTimestamp(rkeyTimestamp()!)}
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
            <RepoSubview archive={props.archive} />
          </Match>

          <Match
            when={(() => {
              const v = props.view();
              return v.type === "collection" ? v : null;
            })()}
            keyed
          >
            {({ collection }) => (
              <CollectionSubview archive={props.archive} collection={collection} />
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

const RepoSubview = (props: { archive: Archive }) => {
  const [filter, setFilter] = createSignal("");
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

      <CollectionList
        collections={props.archive.entries.map((entry) => ({
          nsid: entry.name,
          count: entry.entries.length,
          href: viewToPath({ type: "collection", collection: entry }),
        }))}
        filter={filter()}
        fallback={
          <Show when={filter()}>
            <EmptyState icon="lucide--search-x" message="No collections match your filter" />
          </Show>
        }
      />
    </div>
  );
};

/** Newest first by TID; records with other keys go last. */
const compareRecordKeys = (a: RecordEntry, b: RecordEntry) => {
  const aIsTid = TID.validate(a.key);
  const bIsTid = TID.validate(b.key);
  if (aIsTid && bIsTid) return TID.parse(b.key).timestamp - TID.parse(a.key).timestamp;
  if (aIsTid) return -1;
  if (bIsTid) return 1;
  return b.key.localeCompare(a.key);
};

const CollectionSubview = (props: { archive: Archive; collection: CollectionEntry }) => {
  const source = (): CollectionSource => ({
    key: `${props.archive.did}/${props.collection.name}`,
    repo: props.archive.did,
    collection: props.collection.name,
    collectionHref: viewToPath({ type: "collection", collection: props.collection }),
    recordHref: (rkey) =>
      `${viewToPath({ type: "collection", collection: props.collection })}/${rkey}`,
    // The archive is already in memory, so the whole collection is one page.
    listRecords: async ({ reverse }) => {
      const sorted = [...props.collection.entries].sort(compareRecordKeys);
      if (reverse) sorted.reverse();
      return {
        records: sorted.map((entry) => ({ rkey: entry.key, cid: entry.cid, value: entry.record })),
      };
    },
  });

  return <CollectionPage source={source()} />;
};

const RecordSubview = (props: {
  archive: Archive;
  collection: CollectionEntry;
  record: RecordEntry;
}) => {
  const location = useLocation();
  const lexicon = useLexiconSchema(() => props.collection.name);
  const schemaValidation = useRecordSchemaValidation(
    () => props.collection.name,
    () => props.record.key,
  );

  createEffect(() => {
    if (props.record.record !== null) schemaValidation.validateLocal(props.record.record);
    else schemaValidation.reset();
  });

  return (
    <RecordPage
      tabs={[
        { id: "record", label: "Record" },
        { id: "schema", label: "Schema" },
        { id: "info", label: "Info", error: schemaValidation.valid() === false },
      ]}
      activeTab={recordTabFromHash(location.hash)}
      tabHref={(tab) =>
        `${viewToPath({ type: "record", collection: props.collection, record: props.record })}#${tab}`
      }
      actions={
        <MenuProvider>
          <DropdownMenu icon="lucide--ellipsis" buttonClass="rounded-sm p-1.5">
            <CopyMenu
              content={JSON.stringify(props.record.record, null, 2)}
              label="Copy record"
              icon="lucide--copy"
            />
          </DropdownMenu>
        </MenuProvider>
      }
      record={
        <Show
          when={props.record.record !== null}
          fallback={<ErrorNotice message="Failed to decode record" />}
        >
          <JSONValue data={props.record.record} repo={props.archive.did || ""} newTab hideBlobs />
        </Show>
      }
      schema={
        <SchemaTabContent
          schema={lexicon.schema()}
          loading={lexicon.loading()}
          error={lexicon.error()}
          fallbackSchema={
            props.collection.name === "com.atproto.lexicon.schema" ? props.record.record : undefined
          }
        />
      }
      info={
        <RecordInfo
          uri={`at://${props.archive.did}/${props.collection.name}/${props.record.key}`}
          cid={props.record.cid}
          schema={schemaValidation}
          value={props.record.record}
        />
      }
    />
  );
};
