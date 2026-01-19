import { For, Show } from "solid-js";
import { STREAM_CONFIGS, StreamType } from "./config";

export type StreamStats = {
  connectedAt?: number;
  totalEvents: number;
  eventsPerSecond: number;
  eventTypes: Record<string, number>;
  collections: Record<string, number>;
};

const formatUptime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

export const StreamStatsPanel = (props: {
  stats: StreamStats;
  currentTime: number;
  streamType: StreamType;
}) => {
  const config = () => STREAM_CONFIGS[props.streamType];
  const uptime = () => (props.stats.connectedAt ? props.currentTime - props.stats.connectedAt : 0);

  const topCollections = () =>
    Object.entries(props.stats.collections)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

  const topEventTypes = () =>
    Object.entries(props.stats.eventTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

  return (
    <Show when={props.stats.connectedAt !== undefined}>
      <div class="w-full text-sm">
        <div class="mb-1 font-semibold">Statistics</div>
        <div class="flex flex-wrap justify-between gap-x-4 gap-y-2">
          <div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">Uptime</div>
            <div class="font-mono">{formatUptime(uptime())}</div>
          </div>
          <div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">Total Events</div>
            <div class="font-mono">{props.stats.totalEvents.toLocaleString()}</div>
          </div>
          <div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">Events/sec</div>
            <div class="font-mono">{props.stats.eventsPerSecond.toFixed(1)}</div>
          </div>
          <div>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">Avg/sec</div>
            <div class="font-mono">
              {uptime() > 0 ? ((props.stats.totalEvents / uptime()) * 1000).toFixed(1) : "0.0"}
            </div>
          </div>
        </div>

        <Show when={topEventTypes().length > 0 && config().showEventTypes}>
          <div class="mt-2">
            <div class="mb-1 text-xs text-neutral-500 dark:text-neutral-400">Event Types</div>
            <div class="grid grid-cols-[1fr_5rem_3rem] gap-x-1 gap-y-0.5 font-mono text-xs sm:gap-x-4">
              <For each={topEventTypes()}>
                {([type, count]) => {
                  const percentage = ((count / props.stats.totalEvents) * 100).toFixed(1);
                  return (
                    <>
                      <span class="text-neutral-700 dark:text-neutral-300">{type}</span>
                      <span class="text-right text-neutral-600 tabular-nums dark:text-neutral-400">
                        {count.toLocaleString()}
                      </span>
                      <span class="text-right text-neutral-400 tabular-nums dark:text-neutral-500">
                        {percentage}%
                      </span>
                    </>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>

        <Show when={topCollections().length > 0}>
          <div class="mt-2">
            <div class="mb-1 text-xs text-neutral-500 dark:text-neutral-400">
              {config().collectionsLabel}
            </div>
            <div class="grid grid-cols-[1fr_5rem_3rem] gap-x-1 gap-y-0.5 font-mono text-xs sm:gap-x-4">
              <For each={topCollections()}>
                {([collection, count]) => {
                  const percentage = ((count / props.stats.totalEvents) * 100).toFixed(1);
                  return (
                    <>
                      <span class="min-w-0 truncate text-neutral-700 dark:text-neutral-300">
                        {collection}
                      </span>
                      <span class="text-right text-neutral-600 tabular-nums dark:text-neutral-400">
                        {count.toLocaleString()}
                      </span>
                      <span class="text-right text-neutral-400 tabular-nums dark:text-neutral-500">
                        {percentage}%
                      </span>
                    </>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
};
