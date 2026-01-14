import { Client, simpleFetchHandler } from "@atcute/client";
import { ActorIdentifier } from "@atcute/lexicons";
import { A } from "@solidjs/router";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { isTouchDevice } from "../layout";
import { getPDS } from "../utils/api";
import { JSONValue } from "./json";

interface RecordHoverCardProps {
  uri: string;
  newTab?: boolean;
}

const recordCache = new Map<string, { value: unknown; loading: boolean; error?: string }>();

const parseAtUri = (uri: string) => {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { repo: match[1], collection: match[2], rkey: match[3] };
};

const prefetchRecord = async (uri: string) => {
  if (recordCache.has(uri)) return;

  const parsed = parseAtUri(uri);
  if (!parsed) return;

  recordCache.set(uri, { value: null, loading: true });

  try {
    const pds = await getPDS(parsed.repo);
    const rpc = new Client({ handler: simpleFetchHandler({ service: pds }) });
    const res = await rpc.get("com.atproto.repo.getRecord", {
      params: {
        repo: parsed.repo as ActorIdentifier,
        collection: parsed.collection as `${string}.${string}.${string}`,
        rkey: parsed.rkey,
      },
    });

    if (!res.ok) {
      recordCache.set(uri, { value: null, loading: false, error: res.data.error });
      return;
    }

    recordCache.set(uri, { value: res.data.value, loading: false });
  } catch (err: any) {
    recordCache.set(uri, { value: null, loading: false, error: err.message || "Failed to fetch" });
  }
};

const RecordHoverCard = (props: RecordHoverCardProps) => {
  const [show, setShow] = createSignal(false);
  const [record, setRecord] = createSignal<{
    value: unknown;
    loading: boolean;
    error?: string;
  } | null>(null);
  let hoverTimeout: ReturnType<typeof setTimeout> | undefined;
  let hideTimeout: ReturnType<typeof setTimeout> | undefined;

  const [previewHeight, setPreviewHeight] = createSignal(0);
  let rkeyRef!: HTMLSpanElement;
  let previewRef!: HTMLDivElement;

  createEffect(() => {
    if (show() && previewRef) setPreviewHeight(previewRef.offsetHeight);
  });

  const isOverflowing = (previewHeight: number) =>
    rkeyRef && rkeyRef.offsetTop - window.scrollY + previewHeight + 32 > window.innerHeight;

  const parsed = () => parseAtUri(props.uri);

  const handleMouseEnter = () => {
    clearTimeout(hideTimeout);

    prefetchRecord(props.uri);

    hoverTimeout = setTimeout(() => {
      const cached = recordCache.get(props.uri);
      setRecord(cached || { value: null, loading: true });
      setShow(true);

      // Poll for updates while loading
      if (cached?.loading) {
        const pollInterval = setInterval(() => {
          const updated = recordCache.get(props.uri);
          if (updated && !updated.loading) {
            setRecord(updated);
            clearInterval(pollInterval);
          }
        }, 100);

        setTimeout(() => clearInterval(pollInterval), 10000);
      }
    }, 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimeout);
    hideTimeout = setTimeout(() => {
      setShow(false);
    }, 150);
  };

  onCleanup(() => {
    clearTimeout(hoverTimeout);
    clearTimeout(hideTimeout);
  });

  return (
    <span
      ref={rkeyRef}
      class="group/hover-card relative inline"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <A
        class="text-blue-500 hover:underline active:underline dark:text-blue-400"
        href={`/${props.uri}`}
        target={props.newTab ? "_blank" : "_self"}
      >
        {props.uri}
      </A>
      <Show when={show() && !isTouchDevice}>
        <div
          ref={previewRef}
          class={`dark:bg-dark-300 dark:shadow-dark-700 pointer-events-none absolute left-[50%] z-50 block max-h-80 w-max max-w-sm -translate-x-1/2 overflow-hidden rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-xs whitespace-pre-wrap shadow-md sm:max-h-112 lg:max-w-lg dark:border-neutral-700 ${isOverflowing(previewHeight()) ? "bottom-7" : "top-7"}`}
          onMouseEnter={() => clearTimeout(hideTimeout)}
          onMouseLeave={handleMouseLeave}
        >
          <Show when={record()?.loading}>
            <div class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <span class="iconify lucide--loader-circle animate-spin" />
              Loading...
            </div>
          </Show>
          <Show when={record()?.error}>
            <div class="text-sm text-red-500 dark:text-red-400">{record()?.error}</div>
          </Show>
          <Show when={record()?.value && !record()?.loading}>
            <div class="font-mono text-xs whitespace-pre-wrap">
              <JSONValue
                data={record()?.value as any}
                repo={parsed()?.repo || ""}
                truncate
                newTab
              />
            </div>
          </Show>
        </div>
      </Show>
    </span>
  );
};

export default RecordHoverCard;
