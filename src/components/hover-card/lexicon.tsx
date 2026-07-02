import type { Nsid } from "@atcute/lexicons";
import { A } from "@solidjs/router";
import { Show } from "solid-js";

import { parseLexiconRef, resolveLexicon, schemaHref } from "../../lib/lexicon";
import { LexiconSchemaView, type LexiconSchema } from "../lexicon-schema";
import HoverCard, { HoverCardError, type HoverTriggerRenderer } from "./base";
import { createHoverResource } from "./resource";

interface LexiconHoverCardProps {
  lexicon: string;
  newTab?: boolean;
  class?: string;
  renderTrigger?: HoverTriggerRenderer;
  hoverDelay?: number;
}

const fetchLexiconPreview = async (nsid: string): Promise<LexiconSchema> => {
  const { schema } = await resolveLexicon(nsid as Nsid);
  return schema.rawSchema as LexiconSchema;
};

const LexiconHoverCard = (props: LexiconHoverCardProps) => {
  const parsed = () => parseLexiconRef(props.lexicon);
  const href = () => schemaHref(parsed().nsid, parsed().defName);
  const preview = createHoverResource(() => parsed().nsid, fetchLexiconPreview, {
    getErrorMessage: (err) => (err instanceof Error ? err.message : "Failed to resolve schema"),
  });
  const loading = preview.visibleLoading;
  const hasPreview = () => Boolean(preview.state().data || preview.state().error);
  const trigger = () =>
    props.renderTrigger?.({ loading }) ?? (
      <A
        class="text-blue-500 hover:underline active:underline dark:text-blue-400"
        classList={{ "hover-card-trigger-loading": loading() }}
        href={href()}
        target={props.newTab ? "_blank" : undefined}
      >
        {props.lexicon}
      </A>
    );

  return (
    <HoverCard
      onHover={preview.load}
      hoverDelay={props.hoverDelay ?? 300}
      trigger={trigger()}
      class={props.class}
      previewClass="max-h-[32rem] w-[min(36rem,calc(100vw-2rem))] font-sans text-sm"
      showPreview={hasPreview()}
    >
      <Show when={preview.state().error}>
        <HoverCardError message={preview.state().error} />
      </Show>
      <Show when={preview.state().data}>
        {(data) => (
          <LexiconSchemaView schema={data()} preview inertRefs focusDef={parsed().defName} />
        )}
      </Show>
    </HoverCard>
  );
};

export default LexiconHoverCard;
