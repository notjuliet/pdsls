import { isCid, isDid, isNsid, isResourceUri, Nsid } from "@atcute/lexicons/syntax";
import { A, useNavigate, useParams } from "@solidjs/router";
import {
  createContext,
  createEffect,
  createResource,
  createSignal,
  ErrorBoundary,
  For,
  on,
  onCleanup,
  Show,
  useContext,
} from "solid-js";
import { Portal } from "solid-js/web";
import { resolveLexiconAuthority } from "../utils/api";
import { formatFileSize } from "../utils/format";
import { hideMedia } from "../views/settings";
import DidHoverCard from "./hover-card/did";
import RecordHoverCard from "./hover-card/record";
import { pds } from "./navbar";
import { addNotification, removeNotification } from "./notification";
import VideoPlayer from "./video-player";

interface JSONContext {
  repo: string;
  truncate?: boolean;
  parentIsBlob?: boolean;
  newTab?: boolean;
  hideBlobs?: boolean;
}

const JSONCtx = createContext<JSONContext>();
const useJSONCtx = () => useContext(JSONCtx)!;

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
  const navigate = useNavigate();
  const params = useParams();

  const handleClick = async (lex: string) => {
    try {
      const [nsid, anchor] = lex.split("#");
      const authority = await resolveLexiconAuthority(nsid as Nsid);

      const hash = anchor ? `#schema:${anchor}` : "#schema";
      if (ctx.newTab)
        window.open(`/at://${authority}/com.atproto.lexicon.schema/${nsid}${hash}`, "_blank");
      else navigate(`/at://${authority}/com.atproto.lexicon.schema/${nsid}${hash}`);
    } catch (err) {
      console.error("Failed to resolve lexicon authority:", err);
      const id = addNotification({
        message: "Could not resolve schema",
        type: "error",
      });
      setTimeout(() => removeNotification(id), 5000);
    }
  };

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
            {isResourceUri(part) ?
              <RecordHoverCard uri={part} newTab={ctx.newTab} />
            : isDid(part) ?
              <DidHoverCard did={part} newTab={ctx.newTab} />
            : isNsid(part.split("#")[0]) && props.isType ?
              <button
                type="button"
                onClick={() => handleClick(part)}
                class="cursor-pointer text-blue-500 hover:underline active:underline dark:text-blue-400"
              >
                {part}
              </button>
            : isCid(part) && props.isLink && ctx.parentIsBlob && params.repo ?
              <A
                class="text-blue-500 hover:underline active:underline dark:text-blue-400"
                rel="noopener"
                target="_blank"
                href={`https://${pds()}/xrpc/com.atproto.sync.getBlob?did=${params.repo}&cid=${part}`}
              >
                {part}
              </A>
            : (
              isURL(part) &&
              ["http:", "https:", "web+at:"].includes(new URL(part).protocol) &&
              part.split("\n").length === 1
            ) ?
              <a
                class="underline hover:text-blue-500 dark:hover:text-blue-400"
                href={part}
                target="_blank"
                rel="noopener"
              >
                {part}
              </a>
            : part}
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
  const [show, setShow] = createSignal(true);
  const isBlobContext = props.parentIsBlob ?? ctx.parentIsBlob;

  const isObject = () => props.value === Object(props.value);
  const isEmpty = () =>
    Array.isArray(props.value) ?
      (props.value as JSONType[]).length === 0
    : Object.keys(props.value as object).length === 0;
  const isCollapsible = () => (isObject() && !isEmpty()) || typeof props.value === "string";
  const summary = () => {
    if (typeof props.value === "string") {
      const len = props.value.length;
      return `${len.toLocaleString()} ${len === 1 ? "char" : "chars"}`;
    }
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
      <button
        class="group/clip relative flex size-fit shrink-0 items-center gap-x-1 wrap-anywhere"
        classList={{
          "max-w-[40%] sm:max-w-[50%]": props.maxWidth !== undefined && show(),
          "text-indigo-500 hover:text-indigo-700 active:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 dark:active:text-indigo-200":
            !props.isIndex,
          "text-violet-500 hover:text-violet-700 active:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 dark:active:text-violet-200":
            props.isIndex,
        }}
        onclick={() => isCollapsible() && setShow(!show())}
      >
        <Show when={isCollapsible()}>
          <span
            classList={{
              "dark:bg-dark-500 absolute w-4 text-neutral-500 dark:text-neutral-400 flex items-center -left-4 bg-neutral-100 text-sm": true,
              "hidden group-hover/clip:flex": show(),
            }}
          >
            {show() ?
              <span class="iconify lucide--chevron-down"></span>
            : <span class="iconify lucide--chevron-right"></span>}
          </span>
        </Show>
        <span>
          {props.label}
          <span class="text-neutral-500 dark:text-neutral-400">:</span>
        </span>
        <Show when={!show() && summary()}>
          <span class="absolute left-full ml-1 whitespace-nowrap text-neutral-400 dark:text-neutral-500">
            {summary()}
          </span>
        </Show>
      </button>
      <span
        classList={{
          "self-center": !isObject() || isEmpty(),
          "pl-[calc(2ch-0.5px)] border-l-[0.5px] border-neutral-500/50 dark:border-neutral-400/50 has-hover:group-hover/indent:border-neutral-700 transition-colors dark:has-hover:group-hover/indent:border-neutral-400":
            isObject() && !isEmpty(),
          "invisible h-0 overflow-hidden": !show(),
        }}
      >
        <JSONCtx.Provider value={{ ...ctx, parentIsBlob: isBlobContext }}>
          <JSONValueInner
            data={props.value}
            isType={props.isType}
            isLink={props.isLink}
            isSize={props.isSize}
          />
        </JSONCtx.Provider>
      </span>
    </span>
  );
};

const JSONObject = (props: { data: { [x: string]: JSONType } }) => {
  const ctx = useJSONCtx();
  const params = useParams();
  const [hide, setHide] = createSignal(
    localStorage.hideMedia === "true" || params.rkey === undefined,
  );
  const [mediaLoaded, setMediaLoaded] = createSignal(false);

  createEffect(() => {
    if (hideMedia()) setHide(hideMedia());
  });

  createEffect(
    on(
      hide,
      (value) => {
        if (value === false) setMediaLoaded(false);
      },
      { defer: true },
    ),
  );

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
    pds() &&
    !ctx.hideBlobs &&
    (blob.mimeType.startsWith("image/") || blob.mimeType === "video/mp4");

  const MediaDisplay = () => {
    const [expanded, setExpanded] = createSignal(false);

    createEffect(() => {
      if (!expanded()) return;
      const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
      window.addEventListener("keydown", handler);
      onCleanup(() => window.removeEventListener("keydown", handler));
    });
    const [imageUrl] = createResource(
      () => (blob.mimeType.startsWith("image/") ? blob.ref.$link : null),
      async (cid) => {
        const url = `https://${pds()}/xrpc/com.atproto.sync.getBlob?did=${ctx.repo}&cid=${cid}`;

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
        <span class="group/media relative flex w-fit">
          <Show when={!hide()}>
            <Show when={blob.mimeType.startsWith("image/")}>
              <Show
                when={!imageUrl.loading && imageUrl()}
                fallback={
                  <div class="flex h-48 w-48 items-center justify-center rounded bg-neutral-200 dark:bg-neutral-800">
                    <span class="iconify lucide--loader-circle animate-spin text-xl text-neutral-400 dark:text-neutral-500"></span>
                  </div>
                }
              >
                <img
                  class="h-auto max-h-48 max-w-64 cursor-zoom-in object-contain"
                  src={imageUrl()}
                  onLoad={() => setMediaLoaded(true)}
                  onclick={() => setExpanded(true)}
                />
                <Show when={expanded()}>
                  <Portal>
                    <div
                      class="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80"
                      onclick={() => setExpanded(false)}
                    >
                      <img
                        class="max-h-screen max-w-screen object-contain"
                        src={imageUrl()}
                      />
                    </div>
                  </Portal>
                </Show>
              </Show>
            </Show>
            <Show when={blob.mimeType === "video/mp4"}>
              <ErrorBoundary fallback={() => <span>Failed to load video</span>}>
                <VideoPlayer
                  did={ctx.repo}
                  cid={blob.ref.$link}
                  onLoad={() => setMediaLoaded(true)}
                />
              </ErrorBoundary>
            </Show>
            <Show when={mediaLoaded()}>
              <button
                onclick={() => setHide(true)}
                class="absolute top-1 right-1 flex items-center rounded-lg bg-neutral-700/70 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/media:opacity-100 hover:bg-neutral-700 active:bg-neutral-800 dark:bg-neutral-100/70 dark:text-neutral-900 dark:hover:bg-neutral-100 dark:active:bg-neutral-200"
              >
                <span class="iconify lucide--eye-off text-base"></span>
              </button>
            </Show>
          </Show>
          <Show when={hide()}>
            <button
              onclick={() => setHide(false)}
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
  truncate?: boolean;
  newTab?: boolean;
  hideBlobs?: boolean;
}) => {
  return (
    <JSONCtx.Provider
      value={{
        repo: props.repo,
        truncate: props.truncate,
        newTab: props.newTab,
        hideBlobs: props.hideBlobs,
      }}
    >
      <JSONValueInner data={props.data} />
    </JSONCtx.Provider>
  );
};

export type JSONType = string | number | boolean | null | { [x: string]: JSONType } | JSONType[];
