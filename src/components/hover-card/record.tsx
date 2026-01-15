import { Client, simpleFetchHandler } from "@atcute/client";
import { ActorIdentifier } from "@atcute/lexicons";
import { createSignal, Show } from "solid-js";
import { getPDS } from "../../utils/api";
import { JSONValue } from "../json";
import HoverCard from "./base";

interface RecordHoverCardProps {
  uri: string;
  newTab?: boolean;
  class?: string;
  labelClass?: string;
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
  const [record, setRecord] = createSignal<{
    value: unknown;
    loading: boolean;
    error?: string;
  } | null>(null);

  const parsed = () => parseAtUri(props.uri);

  const handlePrefetch = () => {
    prefetchRecord(props.uri);

    // Start polling for cache updates
    const cached = recordCache.get(props.uri);
    setRecord(cached || { value: null, loading: true });

    if (!cached || cached.loading) {
      const pollInterval = setInterval(() => {
        const updated = recordCache.get(props.uri);
        if (updated && !updated.loading) {
          setRecord(updated);
          clearInterval(pollInterval);
        }
      }, 100);

      setTimeout(() => clearInterval(pollInterval), 10000);
    }
  };

  return (
    <HoverCard
      href={`/${props.uri}`}
      label={props.uri}
      newTab={props.newTab}
      onHover={handlePrefetch}
      class={props.class}
      labelClass={props.labelClass}
      previewClass="max-h-80 w-max max-w-sm text-xs whitespace-pre-wrap sm:max-h-112 lg:max-w-lg"
    >
      <Show when={record()?.loading}>
        <div class="flex items-center gap-2 font-sans text-sm text-neutral-500 dark:text-neutral-400">
          <span class="iconify lucide--loader-circle animate-spin" />
          Loading...
        </div>
      </Show>
      <Show when={record()?.error}>
        <div class="font-sans text-sm text-red-500 dark:text-red-400">{record()?.error}</div>
      </Show>
      <Show when={record()?.value && !record()?.loading}>
        <div class="font-mono text-xs wrap-break-word">
          <JSONValue
            data={record()?.value as any}
            repo={parsed()?.repo || ""}
            truncate
            newTab
            hideBlobs
          />
        </div>
      </Show>
    </HoverCard>
  );
};

export default RecordHoverCard;
