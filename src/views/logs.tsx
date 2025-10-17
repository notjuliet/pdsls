import {
  CompatibleOperationOrTombstone,
  defs,
  IndexedEntry,
  processIndexedEntryLog,
} from "@atcute/did-plc";
import { createResource, createSignal, For, Show } from "solid-js";
import { localDateFromTimestamp } from "../utils/date.js";
import { createOperationHistory, DiffEntry, groupBy } from "../utils/plc-logs.js";

type PlcEvent = "handle" | "rotation_key" | "service" | "verification_method";

export const PlcLogView = (props: { did: string }) => {
  const [activePlcEvent, setActivePlcEvent] = createSignal<PlcEvent | undefined>();

  const fetchPlcLogs = async () => {
    const res = await fetch(
      `${localStorage.plcDirectory ?? "https://plc.directory"}/${props.did}/log/audit`,
    );
    const json = await res.json();
    const logs = defs.indexedEntryLog.parse(json);
    try {
      await processIndexedEntryLog(props.did as any, logs);
    } catch (e) {
      console.error(e);
    }
    const opHistory = createOperationHistory(logs).reverse();
    return Array.from(groupBy(opHistory, (item) => item.orig));
  };

  const [plcOps] =
    createResource<[IndexedEntry<CompatibleOperationOrTombstone>, DiffEntry[]][]>(fetchPlcLogs);

  const FilterButton = (props: { icon: string; event: PlcEvent }) => (
    <button
      classList={{
        "flex items-center rounded-full p-1.5": true,
        "bg-neutral-700 dark:bg-neutral-200": activePlcEvent() === props.event,
        "hover:bg-neutral-200 dark:hover:bg-neutral-700": activePlcEvent() !== props.event,
      }}
      onclick={() => setActivePlcEvent(activePlcEvent() === props.event ? undefined : props.event)}
    >
      <span
        class={`${props.icon} ${activePlcEvent() === props.event ? "text-neutral-200 dark:text-neutral-900" : ""}`}
      ></span>
    </button>
  );

  const DiffItem = (props: { diff: DiffEntry }) => {
    const diff = props.diff;
    let title = "Unknown log entry";
    let icon = "lucide--circle-help";
    let value = "";

    if (diff.type === "identity_created") {
      icon = "lucide--bell";
      title = `Identity created`;
    } else if (diff.type === "identity_tombstoned") {
      icon = "lucide--skull";
      title = `Identity tombstoned`;
    } else if (diff.type === "handle_added" || diff.type === "handle_removed") {
      icon = "lucide--at-sign";
      title = diff.type === "handle_added" ? "Alias added" : "Alias removed";
      value = diff.handle;
    } else if (diff.type === "handle_changed") {
      icon = "lucide--at-sign";
      title = "Alias updated";
      value = `${diff.prev_handle} → ${diff.next_handle}`;
    } else if (diff.type === "rotation_key_added" || diff.type === "rotation_key_removed") {
      icon = "lucide--key-round";
      title = diff.type === "rotation_key_added" ? "Rotation key added" : "Rotation key removed";
      value = diff.rotation_key;
    } else if (diff.type === "service_added" || diff.type === "service_removed") {
      icon = "lucide--hard-drive";
      title = `Service ${diff.service_id} ${diff.type === "service_added" ? "added" : "removed"}`;
      value = `${diff.service_endpoint}`;
    } else if (diff.type === "service_changed") {
      icon = "lucide--hard-drive";
      title = `Service ${diff.service_id} updated`;
      value = `${diff.prev_service_endpoint} → ${diff.next_service_endpoint}`;
    } else if (
      diff.type === "verification_method_added" ||
      diff.type === "verification_method_removed"
    ) {
      icon = "lucide--shield-check";
      title = `Verification method ${diff.method_id} ${diff.type === "verification_method_added" ? "added" : "removed"}`;
      value = `${diff.method_key}`;
    } else if (diff.type === "verification_method_changed") {
      icon = "lucide--shield-check";
      title = `Verification method ${diff.method_id} updated`;
      value = `${diff.prev_method_key} → ${diff.next_method_key}`;
    }

    return (
      <div class="grid grid-cols-[min-content_1fr] items-center gap-x-1">
        <div class={icon + ` iconify shrink-0`} />
        <p
          classList={{
            "font-semibold": true,
            "text-neutral-400 line-through dark:text-neutral-600": diff.orig.nullified,
          }}
        >
          {title}
        </p>
        <div></div>
        {value}
      </div>
    );
  };

  return (
    <div class="flex w-full flex-col gap-2 wrap-anywhere">
      <div class="flex items-center gap-1">
        <div class="iconify lucide--filter" />
        <div class="dark:shadow-dark-700 dark:bg-dark-300 flex w-fit items-center rounded-full border-[0.5px] border-neutral-300 bg-neutral-50 shadow-xs dark:border-neutral-700">
          <FilterButton icon="iconify lucide--at-sign" event="handle" />
          <FilterButton icon="iconify lucide--key-round" event="rotation_key" />
          <FilterButton icon="iconify lucide--hard-drive" event="service" />
          <FilterButton icon="iconify lucide--shield-check" event="verification_method" />
        </div>
      </div>
      <div class="flex flex-col gap-1 text-sm">
        <For each={plcOps()}>
          {([entry, diffs]) => (
            <Show
              when={!activePlcEvent() || diffs.find((d) => d.type.startsWith(activePlcEvent()!))}
            >
              <div class="flex flex-col">
                <span class="text-neutral-500 dark:text-neutral-400">
                  {localDateFromTimestamp(new Date(entry.createdAt).getTime())}
                </span>
                {diffs.map((diff) => (
                  <Show when={!activePlcEvent() || diff.type.startsWith(activePlcEvent()!)}>
                    <DiffItem diff={diff} />
                  </Show>
                ))}
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
};
