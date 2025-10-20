import { isDid, isNsid, Nsid } from "@atcute/lexicons/syntax";
import { A, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createSignal, ErrorBoundary, For, Show } from "solid-js";
import { resolveLexiconAuthority } from "../utils/api";
import { ATURI_RE } from "../utils/types/at-uri";
import { hideMedia } from "../views/settings";
import { pds } from "./navbar";
import Tooltip from "./tooltip";
import VideoPlayer from "./video-player";

interface AtBlob {
  $type: string;
  ref: { $link: string };
  mimeType: string;
}

const JSONString = ({ data }: { data: string }) => {
  const navigate = useNavigate();

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
    }
  };

  return (
    <span>
      "
      <For each={data.split(/(\s)/)}>
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
            : isNsid(part.split("#")[0]) ?
              <button
                type="button"
                onClick={() => handleClick(part)}
                class="cursor-pointer text-blue-400 hover:underline active:underline"
              >
                {part}
              </button>
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

const JSONObject = ({ data, repo }: { data: { [x: string]: JSONType }; repo: string }) => {
  const params = useParams();
  const [hide, setHide] = createSignal(
    localStorage.hideMedia === "true" || params.rkey === undefined,
  );

  createEffect(() => {
    if (hideMedia()) setHide(hideMedia());
  });

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
            "pl-[calc(2ch-0.5px)] border-l-[0.5px] border-neutral-500/50 dark:border-neutral-400/50 has-hover:group-hover/indent:border-neutral-700 dark:has-hover:group-hover/indent:border-neutral-300":
              value === Object(value),
            "invisible h-0": !show(),
          }}
        >
          <JSONValue data={value} repo={repo} />
        </span>
      </span>
    );
  };

  const rawObj = (
    <For each={Object.entries(data)}>{([key, value]) => <Obj key={key} value={value} />}</For>
  );

  const blob: AtBlob = data as any;

  if (blob.$type === "blob") {
    return (
      <>
        <Show when={pds() && params.rkey}>
          <span class="flex gap-x-1">
            <Show when={blob.mimeType.startsWith("image/") && !hide()}>
              <img
                class="size-fit max-h-[16rem] max-w-[16rem]"
                src={`https://${pds()}/xrpc/com.atproto.sync.getBlob?did=${repo}&cid=${blob.ref.$link}`}
              />
            </Show>
            <Show when={blob.mimeType === "video/mp4" && !hide()}>
              <ErrorBoundary fallback={() => <span>Failed to load video</span>}>
                <VideoPlayer did={repo} cid={blob.ref.$link} />
              </ErrorBoundary>
            </Show>
            <span
              classList={{
                "flex items-center justify-between gap-1": true,
                "flex-col": !hide(),
              }}
            >
              <Show when={blob.mimeType.startsWith("image/") || blob.mimeType === "video/mp4"}>
                <Tooltip text={hide() ? "Show" : "Hide"}>
                  <button
                    onclick={() => setHide(!hide())}
                    class={`${!hide() ? "-mt-1 -ml-0.5" : ""} flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600`}
                  >
                    <span
                      class={`iconify text-base ${hide() ? "lucide--eye-off" : "lucide--eye"}`}
                    ></span>
                  </button>
                </Tooltip>
              </Show>
              <Tooltip text="Blob on PDS">
                <a
                  href={`https://${pds()}/xrpc/com.atproto.sync.getBlob?did=${repo}&cid=${blob.ref.$link}`}
                  target="_blank"
                  class={`${!hide() ? "-mb-1 -ml-0.5" : ""} flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600`}
                >
                  <span class="iconify lucide--external-link text-base"></span>
                </a>
              </Tooltip>
            </span>
          </span>
        </Show>
        {rawObj}
      </>
    );
  }

  return rawObj;
};

const JSONArray = ({ data, repo }: { data: JSONType[]; repo: string }) => {
  return (
    <For each={data}>
      {(value, index) => (
        <span
          classList={{
            "flex before:content-['-']": true,
            "mb-2": value === Object(value) && index() !== data.length - 1,
          }}
        >
          <span class="ml-[1ch] w-full">
            <JSONValue data={value} repo={repo} />
          </span>
        </span>
      )}
    </For>
  );
};

export const JSONValue = ({ data, repo }: { data: JSONType; repo: string }) => {
  if (typeof data === "string") return <JSONString data={data} />;
  if (typeof data === "number") return <JSONNumber data={data} />;
  if (typeof data === "boolean") return <JSONBoolean data={data} />;
  if (data === null) return <JSONNull />;
  if (Array.isArray(data)) return <JSONArray data={data} repo={repo} />;
  return <JSONObject data={data} repo={repo} />;
};

export type JSONType = string | number | boolean | null | { [x: string]: JSONType } | JSONType[];
