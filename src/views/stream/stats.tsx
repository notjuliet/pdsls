import { For } from "solid-js";

import { HEADING_TEXT_CLASS, MUTED_CLASS, VALUE_CLASS } from "../../components/ui/info";
import { STREAM_CONFIGS, StreamType } from "./config";

export const TOP_COLLECTION_LIMIT = 5;

export type StreamStats = {
  connectedAt?: number;
  totalEvents: number;
  eventsPerSecond: number;
  collections: Record<string, number>;
};

/** Time connected as a clock, e.g. "0:04", "12:30" or "1:02:03". */
const formatUptime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  const clock = `${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  return hours > 0 ? `${hours}:${clock}` : clock.replace(/^0/, "");
};

/** How many events came in, how fast, and for how long, e.g. "2,204 total  413/s  0:05". */
export const StreamCounts = (props: { stats: StreamStats; currentTime: number }) => {
  const uptime = () => (props.stats.connectedAt ? props.currentTime - props.stats.connectedAt : 0);

  return (
    <span class={`min-w-0 truncate tabular-nums ${HEADING_TEXT_CLASS}`}>
      {props.stats.totalEvents.toLocaleString()}
      <span class={`font-normal ${MUTED_CLASS}`}> total</span>
      <span class="ml-3">{props.stats.eventsPerSecond.toLocaleString()}</span>
      <span class={`font-normal ${MUTED_CLASS}`}>/s</span>
      <span class="ml-3" title="Connected for">
        {formatUptime(uptime())}
      </span>
    </span>
  );
};

/** The collections (or sources) with the most events so far. */
export const TopCollections = (props: {
  stats: StreamStats;
  streamType: StreamType;
  /** How many rows to keep room for, so the events below don't move as collections come in. */
  rows: number;
}) => {
  const topCollections = () =>
    Object.entries(props.stats.collections)
      .sort(([, a], [, b]) => b - a)
      .slice(0, TOP_COLLECTION_LIMIT);

  return (
    // Muted like "Connected to" above, since the rows below are full-color values.
    <section>
      <h3 class={`mb-1 text-sm ${MUTED_CLASS}`}>
        {STREAM_CONFIGS[props.streamType].collectionsLabel}
      </h3>
      {/* Rows are 20px tall with 2px between them. */}
      <div
        class="grid grid-cols-[minmax(0,1fr)_auto_3.5rem] content-start gap-x-4 gap-y-0.5 text-sm"
        style={{ "min-height": `${props.rows * 22 - 2}px` }}
      >
        <For each={topCollections()}>
          {([collection, count]) => (
            <>
              <span class={`min-w-0 truncate ${VALUE_CLASS}`} title={collection}>
                {collection}
              </span>
              <span class={`text-right tabular-nums ${VALUE_CLASS}`}>{count.toLocaleString()}</span>
              <span class={`text-right tabular-nums ${MUTED_CLASS}`}>
                {((count / props.stats.totalEvents) * 100).toFixed(1)}%
              </span>
            </>
          )}
        </For>
      </div>
    </section>
  );
};
