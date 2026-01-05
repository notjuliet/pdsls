import { isCid, isDid, isNsid, isResourceUri, Nsid } from "@atcute/lexicons/syntax";
import { A, useNavigate, useParams } from "@solidjs/router";
import {
  createContext,
  createEffect,
  createSignal,
  ErrorBoundary,
  For,
  on,
  Show,
  useContext,
} from "solid-js";
import { resolveLexiconAuthority } from "../utils/api";
import { hideMedia } from "../views/settings";
import { pds } from "./navbar";
import { addNotification, removeNotification } from "./notification";
import VideoPlayer from "./video-player";

interface JSONContext {
  repo: string;
  truncate?: boolean;
  parentIsBlob?: boolean;
}

const JSONCtx = createContext<JSONContext>();
const useJSONCtx = () => useContext(JSONCtx)!;

interface AtBlob {
  $type: string;
  ref: { $link: string };
  mimeType: string;
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
      navigate(`/at://${authority}/com.atproto.lexicon.schema/${nsid}${hash}`);
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
      "
      <For each={displayData().split(/(\s)/)}>
        {(part) => (
          <>
            {isResourceUri(part) ?
              <A class="text-blue-400 hover:underline active:underline" href={`/${part}`}>
                {part}
              </A>
            : isDid(part) ?
              <A class="text-blue-400 hover:underline active:underline" href={`/at://${part}`}>
                {part}
              </A>
            : isNsid(part.split("#")[0]) && props.isType ?
              <button
                type="button"
                onClick={() => handleClick(part)}
                class="cursor-pointer text-blue-400 hover:underline active:underline"
              >
                {part}
              </button>
            : isCid(part) && props.isLink && ctx.parentIsBlob && params.repo ?
              <A
                class="text-blue-400 hover:underline active:underline"
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
              <a class="underline hover:text-blue-400" href={part} target="_blank" rel="noopener">
                {part}
              </a>
            : part}
          </>
        )}
      </For>
      <Show when={isTruncated()}>
        <span>…</span>
      </Show>
      "
      <Show when={isTruncated()}>
        <span class="ml-1 text-neutral-500 dark:text-neutral-400">
          (+{remainingChars().toLocaleString()})
        </span>
      </Show>
    </span>
  );
};

const JSONNumber = ({ data }: { data: number }) => {
  return <span>{data}</span>;
};

const JSONBoolean = ({ data }: { data: boolean }) => {
  return <span>{data ? "true" : "false"}</span>;
};

const JSONNull = () => {
  return <span>null</span>;
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

  const Obj = ({ key, value }: { key: string; value: JSONType }) => {
    const [show, setShow] = createSignal(true);

    return (
      <span
        classList={{
          "group/indent flex gap-x-1 w-full": true,
          "flex-col": value === Object(value),
        }}
      >
        <button
          class="group/clip relative flex size-fit max-w-[40%] shrink-0 items-center wrap-anywhere text-neutral-500 hover:text-neutral-700 active:text-neutral-700 sm:max-w-[50%] dark:text-neutral-400 dark:hover:text-neutral-300 dark:active:text-neutral-300"
          onclick={() => setShow(!show())}
        >
          <span
            classList={{
              "dark:bg-dark-500 absolute w-5 flex items-center -left-5 bg-neutral-100 text-sm": true,
              "hidden group-hover/clip:flex": show(),
            }}
          >
            {show() ?
              <span class="iconify lucide--chevron-down"></span>
            : <span class="iconify lucide--chevron-right"></span>}
          </span>
          {key}:
        </button>
        <span
          classList={{
            "self-center": value !== Object(value),
            "pl-[calc(2ch-0.5px)] border-l-[0.5px] border-neutral-500/50 dark:border-neutral-400/50 has-hover:group-hover/indent:border-neutral-700 transition-colors dark:has-hover:group-hover/indent:border-neutral-300":
              value === Object(value),
            "invisible h-0 overflow-hidden": !show(),
          }}
        >
          <JSONCtx.Provider value={{ ...ctx, parentIsBlob: isBlobContext }}>
            <JSONValueInner data={value} isType={key === "$type"} isLink={key === "$link"} />
          </JSONCtx.Provider>
        </span>
      </span>
    );
  };

  const rawObj = (
    <For each={Object.entries(props.data)}>{([key, value]) => <Obj key={key} value={value} />}</For>
  );

  const blob: AtBlob = props.data as any;
  const canShowMedia = () =>
    pds() && params.rkey && (blob.mimeType.startsWith("image/") || blob.mimeType === "video/mp4");

  const MediaDisplay = () => (
    <div>
      <span class="group/media relative flex w-fit">
        <Show when={!hide()}>
          <Show when={blob.mimeType.startsWith("image/")}>
            <img
              class="h-auto max-h-48 max-w-48 object-contain sm:max-h-64 sm:max-w-64"
              src={`https://${pds()}/xrpc/com.atproto.sync.getBlob?did=${ctx.repo}&cid=${blob.ref.$link}`}
              onLoad={() => setMediaLoaded(true)}
            />
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
              class="absolute top-1 right-1 flex items-center rounded-lg bg-neutral-900/70 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover/media:opacity-100 hover:bg-neutral-900/80 active:bg-neutral-900/90 dark:bg-neutral-100/70 dark:text-neutral-900 dark:hover:bg-neutral-100/80 dark:active:bg-neutral-100/90"
            >
              <span class="iconify lucide--eye-off text-base"></span>
            </button>
          </Show>
        </Show>
        <Show when={hide()}>
          <button
            onclick={() => setHide(false)}
            class="flex items-center rounded-lg bg-neutral-200 p-1.5 transition-colors hover:bg-neutral-300 active:bg-neutral-400 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:active:bg-neutral-500"
          >
            <span class="iconify lucide--eye text-base"></span>
          </button>
        </Show>
      </span>
    </div>
  );

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
  return (
    <For each={props.data}>
      {(value, index) => (
        <span
          classList={{
            "flex before:content-['-']": true,
            "mb-2": value === Object(value) && index() !== props.data.length - 1,
          }}
        >
          <span class="ml-[1ch] w-full">
            <JSONValueInner data={value} />
          </span>
        </span>
      )}
    </For>
  );
};

const JSONValueInner = (props: { data: JSONType; isType?: boolean; isLink?: boolean }) => {
  const data = props.data;
  if (typeof data === "string")
    return <JSONString data={data} isType={props.isType} isLink={props.isLink} />;
  if (typeof data === "number") return <JSONNumber data={data} />;
  if (typeof data === "boolean") return <JSONBoolean data={data} />;
  if (data === null) return <JSONNull />;
  if (Array.isArray(data)) return <JSONArray data={data} />;
  return <JSONObject data={data} />;
};

export const JSONValue = (props: { data: JSONType; repo: string; truncate?: boolean }) => {
  return (
    <JSONCtx.Provider value={{ repo: props.repo, truncate: props.truncate }}>
      <JSONValueInner data={props.data} />
    </JSONCtx.Provider>
  );
};

export type JSONType = string | number | boolean | null | { [x: string]: JSONType } | JSONType[];
