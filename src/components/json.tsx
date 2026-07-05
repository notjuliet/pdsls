import { isCid, isDid, isNsid, isResourceUri } from "@atcute/lexicons/syntax";
import { A, useLocation, useParams } from "@solidjs/router";
import {
  createContext,
  createEffect,
  createResource,
  createSignal,
  ErrorBoundary,
  For,
  Show,
  useContext,
} from "solid-js";

import { formatFileSize } from "../utils/format";
import { hideMedia } from "../views/settings";
import DidHoverCard from "./hover-card/did";
import LexiconHoverCard from "./hover-card/lexicon";
import RecordHoverCard from "./hover-card/record";
import VideoPlayer from "./video-player";
import { ZoomableImage } from "./zoomable-image";

interface JSONContext {
  repo: string;
  pds?: string;
  truncate?: boolean;
  parentIsBlob?: boolean;
  newTab?: boolean;
  hideBlobs?: boolean;
  keyLinks?: boolean;
  path?: string;
  preview?: boolean;
  depth?: number;
}

const JSONCtx = createContext<JSONContext>();
const useJSONCtx = () => useContext(JSONCtx)!;

const PREVIEW_EXPANDED_DEPTH = 2;
const PREVIEW_EXPANDED_CHILD_LIMIT = 8;

interface AtBlob {
  $type: string;
  ref: { $link: string };
  mimeType: string;
  size: number;
}

const isURL =
  URL.canParse ??
  ((url, base) => {
    try {
      new URL(url, base);
      return true;
    } catch {
      return false;
    }
  });

const JSONString = (props: { data: string; isType?: boolean; isLink?: boolean }) => {
  const ctx = useJSONCtx();
  const params = useParams();
  const location = useLocation();

  const MAX_LENGTH = 200;
  const isTruncated = () => ctx.truncate && props.data.length > MAX_LENGTH;
  const displayData = () => (isTruncated() ? props.data.slice(0, MAX_LENGTH) : props.data);
  const remainingChars = () => props.data.length - MAX_LENGTH;

  return (
    <span>
      <span class="text-neutral-500 dark:text-neutral-400">"</span>
      <For each={displayData().split(/(\s)/)}>
        {(part) => (
          <>
            {isResourceUri(part) ? (
              <RecordHoverCard uri={part} newTab={ctx.newTab} />
            ) : isDid(part) ? (
              <DidHoverCard did={part} newTab={ctx.newTab} />
            ) : isNsid(part.split("#")[0]) && props.isType ? (
              <LexiconHoverCard lexicon={part} newTab={ctx.newTab} />
            ) : isCid(part) && props.isLink && ctx.parentIsBlob && params.repo ? (
              <A
                class="text-blue-500 hover:underline active:underline dark:text-blue-400"
                href={`/at://${params.repo}/blob/${part}`}
                state={{ from: location.pathname + location.hash, label: "Back to record" }}
              >
                {part}
              </A>
            ) : isURL(part) &&
              ["http:", "https:", "web+at:"].includes(new URL(part).protocol) &&
              part.split("\n").length === 1 ? (
              <a
                class="underline hover:text-blue-500 dark:hover:text-blue-400"
                href={part}
                target="_blank"
                rel="noopener"
              >
                {part}
              </a>
            ) : (
              part
            )}
          </>
        )}
      </For>
      <Show when={isTruncated()}>
        <span>…</span>
      </Show>
      <span class="text-neutral-500 dark:text-neutral-400">"</span>
      <Show when={isTruncated()}>
        <span class="ml-1 text-neutral-500 dark:text-neutral-400">
          (+{remainingChars().toLocaleString()})
        </span>
      </Show>
    </span>
  );
};

const JSONNumber = ({ data, isSize }: { data: number; isSize?: boolean }) => {
  return (
    <span class="flex gap-1">
      {data}
      <Show when={isSize}>
        <span class="text-neutral-500 dark:text-neutral-400">({formatFileSize(data)})</span>
      </Show>
    </span>
  );
};

const CollapsibleItem = (props: {
  label: string | number;
  value: JSONType;
  maxWidth?: string;
  isType?: boolean;
  isLink?: boolean;
  isSize?: boolean;
  isIndex?: boolean;
  parentIsBlob?: boolean;
}) => {
  const ctx = useJSONCtx();
  const location = useLocation();
  const isObject = () => props.value === Object(props.value);
  const isEmpty = () =>
    Array.isArray(props.value)
      ? (props.value as JSONType[]).length === 0
      : Object.keys(props.value as object).length === 0;
  const childCount = () =>
    Array.isArray(props.value)
      ? (props.value as JSONType[]).length
      : Object.keys(props.value as object).length;
  const valueDepth = () => (ctx.depth ?? 0) + 1;
  const shouldCollapsePreview = () =>
    ctx.preview &&
    isObject() &&
    !isEmpty() &&
    (valueDepth() > PREVIEW_EXPANDED_DEPTH || childCount() > PREVIEW_EXPANDED_CHILD_LIMIT);
  const [show, setShow] = createSignal(!shouldCollapsePreview());
  const isBlobContext = props.parentIsBlob ?? ctx.parentIsBlob;

  const labelStr = () => {
    const l = String(props.label);
    return l.startsWith("#") ? l.slice(1) : l;
  };
  const fullPath = () => (ctx.path ? `${ctx.path}.${labelStr()}` : labelStr());
  const isHighlighted = () => location.hash === `#record:${fullPath()}`;

  createEffect(() => {
    if (isHighlighted()) {
      requestAnimationFrame(() => {
        document
          .getElementById(`key-${fullPath()}`)
          ?.scrollIntoView({ behavior: "instant", block: "center" });
      });
    }
  });

  const summary = () => {
    if (Array.isArray(props.value)) {
      const len = (props.value as JSONType[]).length;
      return `[ ${len} ${len === 1 ? "item" : "items"} ]`;
    }
    const len = Object.keys(props.value as object).length;
    return `{ ${len} ${len === 1 ? "key" : "keys"} }`;
  };

  return (
    <span
      classList={{
        "group/indent flex gap-x-1 w-full": true,
        "flex-col": isObject() && !isEmpty(),
      }}
    >
      <span
        class="relative flex size-fit shrink-0 items-center gap-x-1 wrap-anywhere"
        classList={{ "max-w-[40%] sm:max-w-[50%]": props.maxWidth !== undefined && show() }}
      >
        <Show
          when={ctx.keyLinks}
          fallback={
            <span
              classList={{
                "text-indigo-500 dark:text-indigo-400": !props.isIndex,
                "text-violet-500 dark:text-violet-400": props.isIndex,
              }}
            >
              {props.label}
              <span class="text-neutral-500 dark:text-neutral-400">:</span>
            </span>
          }
        >
          <a
            href={`#record:${fullPath()}`}
            id={`key-${fullPath()}`}
            class="group/key rounded"
            classList={{
              "text-indigo-500 hover:text-indigo-700 active:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 dark:active:text-indigo-200":
                !props.isIndex && !isHighlighted(),
              "text-violet-500 hover:text-violet-700 active:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 dark:active:text-violet-200":
                props.isIndex && !isHighlighted(),
              "bg-indigo-200 text-indigo-700 dark:bg-indigo-500/60 dark:text-indigo-200":
                isHighlighted() && !props.isIndex,
              "bg-violet-200 text-violet-700 dark:bg-violet-500/60 dark:text-violet-200":
                isHighlighted() && props.isIndex,
            }}
          >
            <span class="absolute top-1/2 -left-3.5 flex -translate-y-1/2 items-center text-xs text-neutral-500 opacity-0 transition-opacity group-hover/key:opacity-100 dark:text-neutral-400">
              <span class="iconify lucide--link"></span>
            </span>
            {props.label}
            <span class="text-neutral-500 dark:text-neutral-400">:</span>
          </a>
        </Show>
        <Show when={!show() && summary()}>
          <button
            type="button"
            class="cursor-default rounded whitespace-nowrap text-neutral-500 transition-colors hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-blue-400/30 focus-visible:outline-none dark:text-neutral-400 dark:hover:text-neutral-200"
            onclick={() => setShow(true)}
          >
            {summary()}
          </button>
        </Show>
      </span>
      <span
        classList={{
          "self-center": !isObject() || isEmpty(),
          "relative pl-[2ch]": isObject() && !isEmpty(),
          "invisible h-0 overflow-hidden": !show(),
        }}
      >
        <Show when={isObject() && !isEmpty()}>
          <span
            class="group/fold absolute inset-y-0 left-0 z-10 flex w-4 -translate-x-1/2 items-center justify-center"
            onclick={() => setShow(!show())}
          >
            <span class="h-full w-px bg-neutral-300 transition-colors group-hover/fold:bg-neutral-600 dark:bg-neutral-600 dark:group-hover/fold:bg-neutral-300" />
          </span>
        </Show>
        <JSONCtx.Provider
          value={{ ...ctx, parentIsBlob: isBlobContext, path: fullPath(), depth: valueDepth() }}
        >
          <Show when={!ctx.preview || show()}>
            <JSONValueInner
              data={props.value}
              isType={props.isType}
              isLink={props.isLink}
              isSize={props.isSize}
            />
          </Show>
        </JSONCtx.Provider>
      </span>
    </span>
  );
};

const JSONObject = (props: { data: { [x: string]: JSONType } }) => {
  const ctx = useJSONCtx();

  const isBlob = props.data.$type === "blob";
  const isBlobContext = isBlob || ctx.parentIsBlob;

  const rawObj = (
    <For each={Object.entries(props.data)}>
      {([key, value]) => (
        <CollapsibleItem
          label={key}
          value={value}
          maxWidth="set"
          isType={key === "$type"}
          isLink={key === "$link"}
          isSize={key === "size" && isBlob}
          parentIsBlob={isBlobContext}
        />
      )}
    </For>
  );

  const blob: AtBlob = props.data as any;
  const canShowMedia = () =>
    ctx.pds &&
    !ctx.hideBlobs &&
    (blob.mimeType.startsWith("image/") ||
      blob.mimeType === "video/mp4" ||
      blob.mimeType.startsWith("audio/"));

  const MediaDisplay = () => {
    const [overrideShow, setOverrideShow] = createSignal(false);
    const hidden = () => hideMedia() && !overrideShow();

    const [imageUrl] = createResource(
      () => (blob.mimeType.startsWith("image/") ? blob.ref.$link : null),
      async (cid) => {
        const url = `${ctx.pds}/xrpc/com.atproto.sync.getBlob?did=${ctx.repo}&cid=${cid}`;

        await new Promise<void>((resolve) => {
          const img = new Image();
          img.src = url;
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });

        return url;
      },
    );

    return (
      <div>
        <span class="group/media relative my-0.5 flex w-fit">
          <Show when={!hidden()}>
            <Show when={blob.mimeType.startsWith("image/")}>
              <Show
                when={!imageUrl.loading && imageUrl()}
                fallback={
                  <div class="flex h-48 w-48 items-center justify-center rounded bg-neutral-200 dark:bg-neutral-800">
                    <span class="iconify lucide--loader-circle animate-spin text-xl text-neutral-400 dark:text-neutral-500"></span>
                  </div>
                }
              >
                <ZoomableImage src={imageUrl()} class="h-auto max-h-48 max-w-64" />
              </Show>
            </Show>
            <Show when={blob.mimeType === "video/mp4"}>
              <ErrorBoundary fallback={() => <span>Failed to load video</span>}>
                <VideoPlayer did={ctx.repo} cid={blob.ref.$link} />
              </ErrorBoundary>
            </Show>
            <Show when={blob.mimeType.startsWith("audio/")}>
              <audio class="my-0.5 max-w-96" controls>
                <source
                  src={`${ctx.pds}/xrpc/com.atproto.sync.getBlob?did=${ctx.repo}&cid=${blob.ref.$link}`}
                  type={blob.mimeType === "audio/x-flac" ? "audio/flac" : blob.mimeType}
                />
              </audio>
            </Show>
          </Show>
          <Show when={hidden()}>
            <button
              onclick={() => setOverrideShow(true)}
              class="flex items-center gap-1 rounded-md bg-neutral-200 px-2 py-1.5 text-sm transition-colors hover:bg-neutral-300 active:bg-neutral-400 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:active:bg-neutral-500"
            >
              <span class="iconify lucide--image"></span>
              <span class="font-sans">Show media</span>
            </button>
          </Show>
        </span>
      </div>
    );
  };

  if (Object.keys(props.data).length === 0)
    return <span class="text-neutral-400 dark:text-neutral-500">{"{ }"}</span>;

  if (blob.$type === "blob") {
    return (
      <>
        <Show when={canShowMedia()}>
          <MediaDisplay />
        </Show>
        {rawObj}
      </>
    );
  }

  return rawObj;
};

const JSONArray = (props: { data: JSONType[] }) => {
  if (props.data.length === 0)
    return <span class="text-neutral-400 dark:text-neutral-500">[ ]</span>;
  return (
    <For each={props.data}>
      {(value, index) => <CollapsibleItem label={`#${index()}`} value={value} isIndex />}
    </For>
  );
};

const JSONValueInner = (props: {
  data: JSONType;
  isType?: boolean;
  isLink?: boolean;
  isSize?: boolean;
}) => {
  const data = props.data;
  if (typeof data === "string")
    return <JSONString data={data} isType={props.isType} isLink={props.isLink} />;
  if (typeof data === "number") return <JSONNumber data={data} isSize={props.isSize} />;
  if (typeof data === "boolean")
    return <span class="text-amber-500 dark:text-amber-400">{String(data)}</span>;
  if (data === null) return <span class="text-neutral-400 dark:text-neutral-500">null</span>;
  if (Array.isArray(data)) return <JSONArray data={data} />;
  return <JSONObject data={data} />;
};

export const JSONValue = (props: {
  data: JSONType;
  repo: string;
  pds?: string;
  truncate?: boolean;
  newTab?: boolean;
  hideBlobs?: boolean;
  keyLinks?: boolean;
  preview?: boolean;
}) => {
  return (
    <JSONCtx.Provider
      value={{
        repo: props.repo,
        pds: props.pds,
        truncate: props.truncate,
        newTab: props.newTab,
        hideBlobs: props.hideBlobs,
        keyLinks: props.keyLinks,
        preview: props.preview,
      }}
    >
      <JSONValueInner data={props.data} />
    </JSONCtx.Provider>
  );
};

export type JSONType = string | number | boolean | null | { [x: string]: JSONType } | JSONType[];
