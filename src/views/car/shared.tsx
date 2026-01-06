import * as CBOR from "@atcute/cbor";
import * as CID from "@atcute/cid";
import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { type JSONType } from "../../components/json.jsx";

export const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Convert CBOR-decoded objects to JSON-friendly format
export const toJsonValue = (obj: unknown): JSONType => {
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

export interface Archive {
  file: File;
  did: string;
  entries: CollectionEntry[];
}

export interface CollectionEntry {
  name: string;
  entries: RecordEntry[];
}

export interface RecordEntry {
  key: string;
  cid: string;
  record: JSONType;
}

export type View =
  | { type: "repo" }
  | { type: "collection"; collection: CollectionEntry }
  | { type: "record"; collection: CollectionEntry; record: RecordEntry };

export const WelcomeView = (props: {
  title: string;
  subtitle: string;
  loading: boolean;
  error?: string;
  onFileChange: (e: Event) => void;
  onDrop: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
}) => {
  return (
    <div class="flex w-full max-w-3xl flex-col gap-y-4 px-2">
      <div class="flex flex-col gap-y-1">
        <div class="flex items-center gap-2 text-lg">
          <A
            href="/car"
            class="flex size-7 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          >
            <span class="iconify lucide--arrow-left" />
          </A>
          <h1 class="font-semibold">{props.title}</h1>
        </div>
        <p class="text-sm text-neutral-600 dark:text-neutral-400">{props.subtitle}</p>
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
              accept={isIOS ? undefined : ".car,application/vnd.ipld.car"}
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
