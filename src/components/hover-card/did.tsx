import { getPdsEndpoint, type DidDocument } from "@atcute/identity";
import { A } from "@solidjs/router";
import { Show } from "solid-js";

import { resolveDidDoc } from "../../lib/api";
import HoverCard, { HoverCardError, type HoverTriggerRenderer } from "./base";
import { createHoverResource } from "./resource";

interface DidHoverCardProps {
  did: string;
  newTab?: boolean;
  class?: string;
  labelClass?: string;
  renderTrigger?: HoverTriggerRenderer;
  hoverDelay?: number;
}

interface DidInfo {
  handle?: string;
  pds?: string;
}

const didCache = new Map<string, Promise<DidInfo>>();

const fetchDidInfo = async (did: string): Promise<DidInfo> => {
  const doc: DidDocument = await resolveDidDoc(did as `did:${string}:${string}`);

  const handle = doc.alsoKnownAs?.find((aka) => aka.startsWith("at://"))?.replace("at://", "");

  const pds = getPdsEndpoint(doc)?.replace("https://", "").replace("http://", "");

  return { handle, pds };
};

const DidHoverCard = (props: DidHoverCardProps) => {
  const preview = createHoverResource(() => props.did, fetchDidInfo, {
    cache: didCache,
    getErrorMessage: (err) => (err instanceof Error ? err.message : "Failed to resolve"),
  });
  const loading = preview.visibleLoading;
  const hasPreview = () => Boolean(preview.state().data || preview.state().error);
  const trigger = () =>
    props.renderTrigger?.({ loading }) ?? (
      <A
        class={`text-blue-500 hover:underline active:underline dark:text-blue-400 ${props.labelClass || ""}`}
        classList={{ "hover-card-trigger-loading": loading() }}
        href={`/at://${props.did}`}
        target={props.newTab ? "_blank" : undefined}
      >
        {props.did}
      </A>
    );

  return (
    <HoverCard
      onHover={preview.load}
      hoverDelay={props.hoverDelay ?? 300}
      trigger={trigger()}
      class={props.class}
      previewClass="w-max max-w-xs font-sans text-sm"
      showPreview={hasPreview()}
    >
      <Show when={preview.state().error}>
        <HoverCardError message={preview.state().error} />
      </Show>
      <Show when={preview.state().data}>
        <div class="flex flex-col gap-1">
          <Show when={preview.state().data?.handle}>
            <div class="flex items-center gap-2">
              <span class="iconify lucide--at-sign text-neutral-500 dark:text-neutral-400" />
              <span>{preview.state().data?.handle}</span>
            </div>
          </Show>
          <Show when={preview.state().data?.pds}>
            <div class="flex items-center gap-2">
              <span class="iconify lucide--hard-drive text-neutral-500 dark:text-neutral-400" />
              <span>{preview.state().data?.pds}</span>
            </div>
          </Show>
          <Show when={!preview.state().data?.handle && !preview.state().data?.pds}>
            <div class="text-neutral-500 dark:text-neutral-400">No info available</div>
          </Show>
        </div>
      </Show>
    </HoverCard>
  );
};

export default DidHoverCard;
