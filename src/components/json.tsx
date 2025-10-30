import { isCid, isDid, isNsid, Nsid } from "@atcute/lexicons/syntax";
import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createSignal, ErrorBoundary, For, Show } from "solid-js";
import { setNotif } from "../layout";
import { resolveLexiconAuthority } from "../utils/api";
import { ATURI_RE } from "../utils/types/at-uri";
import { hideMedia } from "../views/settings";
import { pds } from "./navbar";
import VideoPlayer from "./video-player";

interface AtBlob {
  $type: string;
  ref: { $link: string };
  mimeType: string;
}

const JSONString = (props: {
  data: string;
  isType?: boolean;
  isLink?: boolean;
  parentIsBlob?: boolean;
}) => {
  const navigate = useNavigate();
  const params = useParams();

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

  const handleClick = async (lex: string) => {
    try {
      const [nsid, anchor] = lex.split("#");
      const authority = await resolveLexiconAuthority(nsid as Nsid);

      const hash = anchor ? `#schema:${anchor}` : "#schema";
      navigate(`/at://${authority}/com.atproto.lexicon.schema/${nsid}${hash}`);
    } catch (err) {
      console.error("Failed to resolve lexicon authority:", err);
      setNotif({
        show: true,
        icon: "lucide--circle-alert",
        text: "Could not resolve schema",
      });
    }
  };

  return (
    <span>
      "
      <For each={props.data.split(/(\s)/)}>
        {(part) => (
          <>
            {ATURI_RE.test(part) ?
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
            : isCid(part) && props.isLink && props.parentIsBlob ?
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
              <a class="underline" href={part} target="_blank" rel="noopener">
                {part}
              </a>
            : part}
          </>
        )}
      </For>
      "
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

const JSONObject = (props: {
  data: { [x: string]: JSONType };
  repo: string;
  parentIsBlob?: boolean;
}) => {
  const params = useParams();
  const [hide, setHide] = createSignal(
    localStorage.hideMedia === "true" || params.rkey === undefined,
  );
  const [mediaLoaded, setMediaLoaded] = createSignal(false);

  createEffect(() => {
    if (hideMedia()) setHide(hideMedia());
  });

  const isBlob = props.data.$type === "blob";
  const isBlobContext = isBlob || props.parentIsBlob;

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
            "invisible h-0": !show(),
          }}
        >
          <JSONValue
            data={value}
            repo={props.repo}
            isType={key === "$type"}
            isLink={key === "$link"}
            parentIsBlob={isBlobContext}
          />
        </span>
      </span>
    );
  };

  const rawObj = (
    <For each={Object.entries(props.data)}>{([key, value]) => <Obj key={key} value={value} />}</For>
  );

  const blob: AtBlob = props.data as any;

  if (blob.$type === "blob") {
    return (
      <>
        <Show when={pds() && params.rkey}>
          <Show when={blob.mimeType.startsWith("image/") || blob.mimeType === "video/mp4"}>
            <span class="group/media relative flex w-fit">
              <Show when={!hide()}>
                <Show when={blob.mimeType.startsWith("image/")}>
                  <img
                    class="h-auto max-h-64 max-w-[16rem] object-contain"
                    src={`https://${pds()}/xrpc/com.atproto.sync.getBlob?did=${props.repo}&cid=${blob.ref.$link}`}
                    onLoad={() => setMediaLoaded(true)}
                  />
                </Show>
                <Show when={blob.mimeType === "video/mp4"}>
                  <ErrorBoundary fallback={() => <span>Failed to load video</span>}>
                    <VideoPlayer
                      did={props.repo}
                      cid={blob.ref.$link}
                      onLoad={() => setMediaLoaded(true)}
                    />
                  </ErrorBoundary>
                </Show>
                <Show when={mediaLoaded()}>
                  <button
                    onclick={() => setHide(true)}
                    class="absolute top-1 right-1 flex items-center rounded-lg bg-neutral-900/70 p-1.5 text-white opacity-100 backdrop-blur-sm transition-opacity hover:bg-neutral-900/80 active:bg-neutral-900/90 sm:opacity-0 sm:group-hover/media:opacity-100 dark:bg-neutral-100/70 dark:text-neutral-900 dark:hover:bg-neutral-100/80 dark:active:bg-neutral-100/90"
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
          </Show>
        </Show>
        {rawObj}
      </>
    );
  }

  return rawObj;
};

const JSONArray = (props: { data: JSONType[]; repo: string; parentIsBlob?: boolean }) => {
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
            <JSONValue data={value} repo={props.repo} parentIsBlob={props.parentIsBlob} />
          </span>
        </span>
      )}
    </For>
  );
};

export const JSONValue = (props: {
  data: JSONType;
  repo: string;
  isType?: boolean;
  isLink?: boolean;
  parentIsBlob?: boolean;
}) => {
  const data = props.data;
  if (typeof data === "string")
    return (
      <JSONString
        data={data}
        isType={props.isType}
        isLink={props.isLink}
        parentIsBlob={props.parentIsBlob}
      />
    );
  if (typeof data === "number") return <JSONNumber data={data} />;
  if (typeof data === "boolean") return <JSONBoolean data={data} />;
  if (data === null) return <JSONNull />;
  if (Array.isArray(data))
    return <JSONArray data={data} repo={props.repo} parentIsBlob={props.parentIsBlob} />;
  return <JSONObject data={data} repo={props.repo} parentIsBlob={props.parentIsBlob} />;
};

export type JSONType = string | number | boolean | null | { [x: string]: JSONType } | JSONType[];
