import { getPdsEndpoint, type DidDocument } from "@atcute/identity";
import { createSignal, Show } from "solid-js";
import { resolveDidDoc } from "../../utils/api";
import HoverCard from "./base";

interface DidHoverCardProps {
  did: string;
  newTab?: boolean;
  class?: string;
  labelClass?: string;
}

interface DidInfo {
  handle?: string;
  pds?: string;
  loading: boolean;
  error?: string;
}

const didCache = new Map<string, DidInfo>();

const prefetchDid = async (did: string) => {
  if (didCache.has(did)) return;

  didCache.set(did, { loading: true });

  try {
    const doc: DidDocument = await resolveDidDoc(did as `did:${string}:${string}`);

    const handle = doc.alsoKnownAs?.find((aka) => aka.startsWith("at://"))?.replace("at://", "");

    const pds = getPdsEndpoint(doc)?.replace("https://", "").replace("http://", "");

    didCache.set(did, { handle, pds, loading: false });
  } catch (err: any) {
    didCache.set(did, { loading: false, error: err.message || "Failed to resolve" });
  }
};

const DidHoverCard = (props: DidHoverCardProps) => {
  const [didInfo, setDidInfo] = createSignal<DidInfo | null>(null);

  const handlePrefetch = () => {
    prefetchDid(props.did);

    const cached = didCache.get(props.did);
    setDidInfo(cached || { loading: true });

    if (!cached || cached.loading) {
      const pollInterval = setInterval(() => {
        const updated = didCache.get(props.did);
        if (updated && !updated.loading) {
          setDidInfo(updated);
          clearInterval(pollInterval);
        }
      }, 100);

      setTimeout(() => clearInterval(pollInterval), 10000);
    }
  };

  return (
    <HoverCard
      href={`/at://${props.did}`}
      label={props.did}
      newTab={props.newTab}
      onHover={handlePrefetch}
      class={props.class}
      labelClass={props.labelClass}
      previewClass="w-max max-w-xs font-sans text-sm"
    >
      <Show when={didInfo()?.loading}>
        <div class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <span class="iconify lucide--loader-circle animate-spin" />
          Loading...
        </div>
      </Show>
      <Show when={didInfo()?.error}>
        <div class="text-sm text-red-500 dark:text-red-400">{didInfo()?.error}</div>
      </Show>
      <Show when={!didInfo()?.loading && !didInfo()?.error}>
        <div class="flex flex-col gap-1">
          <Show when={didInfo()?.handle}>
            <div class="flex items-center gap-2">
              <span class="iconify lucide--at-sign text-neutral-500 dark:text-neutral-400" />
              <span>{didInfo()?.handle}</span>
            </div>
          </Show>
          <Show when={didInfo()?.pds}>
            <div class="flex items-center gap-2">
              <span class="iconify lucide--hard-drive text-neutral-500 dark:text-neutral-400" />
              <span>{didInfo()?.pds}</span>
            </div>
          </Show>
          <Show when={!didInfo()?.handle && !didInfo()?.pds}>
            <div class="text-neutral-500 dark:text-neutral-400">No info available</div>
          </Show>
        </div>
      </Show>
    </HoverCard>
  );
};

export default DidHoverCard;
