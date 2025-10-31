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

  const shouldShowDiff = (diff: DiffEntry) =>
    !activePlcEvent() || diff.type.startsWith(activePlcEvent()!);

  const shouldShowEntry = (diffs: DiffEntry[]) =>
    !activePlcEvent() || diffs.some((d) => d.type.startsWith(activePlcEvent()!));

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

  const FilterButton = (props: { icon: string; event: PlcEvent; label: string }) => {
    const isActive = () => activePlcEvent() === props.event;
    const toggleFilter = () => setActivePlcEvent(isActive() ? undefined : props.event);

    return (
      <button
        classList={{
          "flex items-center gap-1 sm:gap-1.5 rounded-lg px-2 py-1.5 text-xs sm:text-sm transition-colors": true,
          "bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900": isActive(),
          "bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600":
            !isActive(),
        }}
        onclick={toggleFilter}
      >
        <span class={props.icon}></span>
        <span class="font-medium">{props.label}</span>
      </button>
    );
  };

  const DiffItem = (props: { diff: DiffEntry }) => {
    const diff = props.diff;

    const getDiffConfig = () => {
      switch (diff.type) {
        case "identity_created":
          return { icon: "lucide--bell", title: "Identity created" };
        case "identity_tombstoned":
          return { icon: "lucide--skull", title: "Identity tombstoned" };
        case "handle_added":
          return {
            icon: "lucide--at-sign",
            title: "Alias added",
            value: diff.handle,
            isAddition: true,
          };
        case "handle_removed":
          return {
            icon: "lucide--at-sign",
            title: "Alias removed",
            value: diff.handle,
            isRemoval: true,
          };
        case "handle_changed":
          return {
            icon: "lucide--at-sign",
            title: "Alias updated",
            oldValue: diff.prev_handle,
            newValue: diff.next_handle,
          };
        case "rotation_key_added":
          return {
            icon: "lucide--key-round",
            title: "Rotation key added",
            value: diff.rotation_key,
            isAddition: true,
          };
        case "rotation_key_removed":
          return {
            icon: "lucide--key-round",
            title: "Rotation key removed",
            value: diff.rotation_key,
            isRemoval: true,
          };
        case "service_added":
          return {
            icon: "lucide--hard-drive",
            title: "Service added",
            badge: diff.service_id,
            value: diff.service_endpoint,
            isAddition: true,
          };
        case "service_removed":
          return {
            icon: "lucide--hard-drive",
            title: "Service removed",
            badge: diff.service_id,
            value: diff.service_endpoint,
            isRemoval: true,
          };
        case "service_changed":
          return {
            icon: "lucide--hard-drive",
            title: "Service updated",
            badge: diff.service_id,
            oldValue: diff.prev_service_endpoint,
            newValue: diff.next_service_endpoint,
          };
        case "verification_method_added":
          return {
            icon: "lucide--shield-check",
            title: "Verification method added",
            badge: diff.method_id,
            value: diff.method_key,
            isAddition: true,
          };
        case "verification_method_removed":
          return {
            icon: "lucide--shield-check",
            title: "Verification method removed",
            badge: diff.method_id,
            value: diff.method_key,
            isRemoval: true,
          };
        case "verification_method_changed":
          return {
            icon: "lucide--shield-check",
            title: "Verification method updated",
            badge: diff.method_id,
            oldValue: diff.prev_method_key,
            newValue: diff.next_method_key,
          };
        default:
          return { icon: "lucide--circle-help", title: "Unknown log entry" };
      }
    };

    const config = getDiffConfig();
    const {
      icon,
      title,
      value = "",
      oldValue = "",
      newValue = "",
      badge = "",
      isAddition = false,
      isRemoval = false,
    } = config;

    return (
      <div
        classList={{
          "grid grid-cols-[auto_1fr] gap-x-2 gap-y-1": true,
          "opacity-60": diff.orig.nullified,
        }}
      >
        <div class={`${icon} iconify shrink-0 self-center`} />
        <div class="flex min-w-0 items-center gap-1.5">
          <p
            classList={{
              "font-semibold text-sm": true,
              "line-through": diff.orig.nullified,
            }}
          >
            {title}
          </p>
          <Show when={badge}>
            <span class="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-medium dark:bg-neutral-700">
              #{badge}
            </span>
          </Show>
          <Show when={diff.orig.nullified}>
            <span class="ml-auto rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium dark:bg-neutral-700">
              Nullified
            </span>
          </Show>
        </div>
        <Show when={value}>
          <div></div>
          <div
            classList={{
              "text-sm break-all flex items-start gap-2 min-w-0": true,
              "text-green-600 dark:text-green-400": isAddition,
              "text-red-600 dark:text-red-400": isRemoval,
              "text-neutral-600 dark:text-neutral-400": !isAddition && !isRemoval,
            }}
          >
            <Show when={isAddition}>
              <span class="shrink-0">+</span>
            </Show>
            <Show when={isRemoval}>
              <span class="shrink-0">−</span>
            </Show>
            <span class="break-all">{value}</span>
          </div>
        </Show>
        <Show when={oldValue && newValue}>
          <div></div>
          <div class="flex min-w-0 flex-col text-sm">
            <div class="flex items-start gap-2 text-red-600 dark:text-red-400">
              <span class="shrink-0">−</span>
              <span class="break-all">{oldValue}</span>
            </div>
            <div class="flex items-start gap-2 text-green-600 dark:text-green-400">
              <span class="shrink-0">+</span>
              <span class="break-all">{newValue}</span>
            </div>
          </div>
        </Show>
      </div>
    );
  };

  return (
    <div class="flex w-full flex-col gap-4 wrap-anywhere">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-1.5 text-sm">
          <div class="iconify lucide--filter" />
          <p class="font-semibold">Filter by type</p>
        </div>
        <div class="flex flex-wrap gap-1 sm:gap-2">
          <FilterButton icon="iconify lucide--at-sign" event="handle" label="Alias" />
          <FilterButton
            icon="iconify lucide--key-round"
            event="rotation_key"
            label="Rotation Key"
          />
          <FilterButton icon="iconify lucide--hard-drive" event="service" label="Service" />
          <FilterButton
            icon="iconify lucide--shield-check"
            event="verification_method"
            label="Verification"
          />
        </div>
      </div>
      <div class="flex flex-col gap-3">
        <For each={plcOps()}>
          {([entry, diffs]) => (
            <Show when={shouldShowEntry(diffs)}>
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2 text-sm">
                  <div class="iconify lucide--clock text-neutral-600 dark:text-neutral-400" />
                  <span class="font-medium text-neutral-700 dark:text-neutral-300">
                    {localDateFromTimestamp(new Date(entry.createdAt).getTime())}
                  </span>
                </div>
                <div class="flex flex-col gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-800">
                  <For each={diffs.filter(shouldShowDiff)}>
                    {(diff) => <DiffItem diff={diff} />}
                  </For>
                </div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
};
