import { Client, simpleFetchHandler } from "@atcute/client";
import type { ActorIdentifier } from "@atcute/lexicons";
import { A } from "@solidjs/router";
import { Show } from "solid-js";

import { getPDS } from "../../lib/api";
import { JSONValue } from "../json";
import HoverCard, { HoverCardError, type HoverTriggerRenderer } from "./base";
import { createHoverResource } from "./resource";

interface RecordHoverCardProps {
  uri: string;
  newTab?: boolean;
  class?: string;
  labelClass?: string;
  renderTrigger?: HoverTriggerRenderer;
  hoverDelay?: number;
}

interface RecordPreview {
  repo: string;
  value: Parameters<typeof JSONValue>[0]["data"];
}

const recordCache = new Map<string, Promise<RecordPreview>>();

const parseAtUri = (uri: string) => {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { repo: match[1], collection: match[2], rkey: match[3] };
};

const fetchRecordPreview = async (uri: string): Promise<RecordPreview> => {
  const parsed = parseAtUri(uri);
  if (!parsed) throw new Error("Invalid AT URI");

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
    throw new Error(res.data.error);
  }

  return { repo: parsed.repo, value: res.data.value as RecordPreview["value"] };
};

const RecordHoverCard = (props: RecordHoverCardProps) => {
  const preview = createHoverResource(() => props.uri, fetchRecordPreview, {
    cache: recordCache,
    getErrorMessage: (err) => (err instanceof Error ? err.message : "Failed to fetch"),
  });

  const parsed = () => parseAtUri(props.uri);
  const loading = preview.visibleLoading;
  const hasPreview = () => Boolean(preview.state().data || preview.state().error);
  const trigger = () =>
    props.renderTrigger?.({ loading }) ?? (
      <A
        class={`text-blue-500 hover:underline active:underline dark:text-blue-400 ${props.labelClass || ""}`}
        classList={{ "hover-card-trigger-loading": loading() }}
        href={`/${props.uri}`}
        target={props.newTab ? "_blank" : undefined}
      >
        {props.uri}
      </A>
    );

  return (
    <HoverCard
      onHover={preview.load}
      hoverDelay={props.hoverDelay ?? 300}
      trigger={trigger()}
      class={props.class}
      showPreview={hasPreview()}
    >
      <Show when={preview.state().error}>
        <HoverCardError message={preview.state().error} />
      </Show>
      <Show when={preview.state().data}>
        {(record) => (
          <div class="font-mono text-xs wrap-break-word">
            <JSONValue
              data={record().value}
              repo={record().repo || parsed()?.repo || ""}
              truncate
              newTab
              hideBlobs
              preview
            />
          </div>
        )}
      </Show>
    </HoverCard>
  );
};

export default RecordHoverCard;
