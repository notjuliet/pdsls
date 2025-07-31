import VideoPlayer from "./video-player";
import { createEffect, createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { pds } from "./navbar";
import Tooltip from "./tooltip";
import { hideMedia } from "./settings";

interface AtBlob {
  $type: string;
  ref: { $link: string };
  mimeType: string;
}

const ATURI_RE =
  /^at:\/\/([a-zA-Z0-9._:%-]+)(?:\/([a-zA-Z0-9-.]+)(?:\/([a-zA-Z0-9._~:@!$&%')(*+,;=-]+))?)?(?:#(\/[a-zA-Z0-9._~:@!$&%')(*+,;=\-[\]/\\]*))?$/;

const DID_RE = /^did:[a-z]+:[a-zA-Z0-9._:%-]*[a-zA-Z0-9._-]$/;

const JSONString = ({ data }: { data: string }) => {
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

  return (
    <span>
      "
      <For each={data.split(/(\s)/)}>
        {(part) => (
          <>
            {ATURI_RE.test(part) ?
              <A class="text-blue-400 hover:underline" href={`/${part}`}>
                {part}
              </A>
            : DID_RE.test(part) ?
              <A class="text-blue-400 hover:underline" href={`/at://${part}`}>
                {part}
              </A>
            : (
              isURL(part) &&
              ["http:", "https:", "web+at:"].includes(new URL(part).protocol) &&
              part.split("\n").length === 1
            ) ?
              <a
                class="text-blue-400 hover:underline"
                href={part}
                target="_blank"
                rel="noopener noreferrer"
              >
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
  const [hide, setHide] = createSignal(localStorage.hideMedia === "true");

  createEffect(() => setHide(hideMedia()));

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
          class="max-w-40% sm:max-w-50% break-anywhere group/clip relative flex size-fit shrink-0 items-center text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          onclick={() => setShow(!show())}
        >
          <span
            classList={{
              "dark:bg-dark-500 absolute w-5 -left-5 bg-zinc-100 text-sm": true,
              "hidden group-hover/clip:block": show(),
            }}
          >
            {show() ?
              <div class="i-lucide-chevron-down" />
            : <div class="i-lucide-chevron-right" />}
          </span>
          {key}:
        </button>
        <span
          classList={{
            "self-center": value !== Object(value),
            "pl-[calc(2ch-1px)] border-l-0.5 border-neutral-500/50 dark:border-neutral-400/50 has-hover:group-hover/indent:border-neutral-700 dark:has-hover:group-hover/indent:border-neutral-300":
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
        <span class="flex gap-x-1">
          <Show when={blob.mimeType.startsWith("image/") && !hide()}>
            <a
              href={`https://cdn.bsky.app/img/feed_thumbnail/plain/${repo}/${blob.ref.$link}@jpeg`}
              target="_blank"
            >
              <img
                class="max-h-[16rem] w-full max-w-[16rem]"
                src={`https://cdn.bsky.app/img/feed_thumbnail/plain/${repo}/${blob.ref.$link}@jpeg`}
              />
            </a>
          </Show>
          <Show when={blob.mimeType === "video/mp4" && !hide()}>
            <VideoPlayer did={repo} cid={blob.ref.$link} />
          </Show>
          <span
            classList={{ "flex items-center justify-between gap-2": true, "flex-col": !hide() }}
          >
            <Show when={blob.mimeType.startsWith("image/") || blob.mimeType === "video/mp4"}>
              <Tooltip text={hide() ? "Show" : "Hide"}>
                <button onclick={() => setHide(!hide())}>
                  <div class={`text-lg ${hide() ? "i-lucide-eye-off" : "i-lucide-eye"}`} />
                </button>
              </Tooltip>
            </Show>
            <Show when={pds()}>
              <a
                href={`https://${pds()}/xrpc/com.atproto.sync.getBlob?did=${repo}&cid=${blob.ref.$link}`}
                target="_blank"
                class="size-fit"
              >
                <Tooltip text="Blob link">
                  <div class="i-lucide-external-link text-lg" />
                </Tooltip>
              </a>
            </Show>
          </span>
        </span>
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
