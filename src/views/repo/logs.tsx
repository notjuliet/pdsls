import {
  CompatibleOperationOrTombstone,
  defs,
  IndexedEntry,
  IndexedEntryLog,
} from "@atcute/did-plc";
import { useLocation } from "@solidjs/router";
import { createEffect, createResource, createSignal, For, onCleanup, Show } from "solid-js";
import * as v from "valibot";

import { HEADING_TEXT_CLASS, LABEL_COLUMN_CLASS, MUTED_CLASS } from "../../components/ui/info.jsx";
import { localDateFromTimestamp } from "../../lib/format.js";
import { detectDidKeyType } from "../../lib/key.js";
import { createOperationHistory, DiffEntry, groupBy } from "../../lib/plc-logs.js";
import { hasStandardServiceId, serviceLabel } from "../../lib/services.js";
import PlcValidateWorker from "../../workers/plc-validate.ts?worker";
import { plcDirectory } from "../settings.jsx";

type PlcEvent = "handle" | "rotation_key" | "service" | "verification_method";

const plcEventFilters: { event?: PlcEvent; label: string }[] = [
  { label: "All events" },
  { event: "handle", label: "Aliases" },
  { event: "service", label: "Services" },
  { event: "verification_method", label: "Verification methods" },
  { event: "rotation_key", label: "Rotation keys" },
];

export const PlcLogView = (props: { did: string }) => {
  const location = useLocation();
  const [activePlcEvent, setActivePlcEvent] = createSignal<PlcEvent | undefined>();
  const [validLog, setValidLog] = createSignal<boolean | undefined>(undefined);
  const [rawLogs, setRawLogs] = createSignal<IndexedEntryLog | undefined>(undefined);

  const shouldShowDiff = (diff: DiffEntry) =>
    !activePlcEvent() || diff.type.startsWith(activePlcEvent()!);

  const shouldShowEntry = (diffs: DiffEntry[]) =>
    !activePlcEvent() || diffs.some((d) => d.type.startsWith(activePlcEvent()!));

  const fetchPlcLogs = async () => {
    const res = await fetch(`${plcDirectory()}/${props.did}/log/audit`);
    const json = await res.json();
    const logs = v.parse(defs.indexedEntryLog, json);
    setRawLogs(logs);
    const opHistory = createOperationHistory(logs).reverse();
    return Array.from(groupBy(opHistory, (item) => item.orig));
  };

  const [plcOps] =
    createResource<[IndexedEntry<CompatibleOperationOrTombstone>, DiffEntry[]][]>(fetchPlcLogs);

  let worker: Worker | undefined;
  onCleanup(() => worker?.terminate());

  createEffect(() => {
    const logs = rawLogs();
    if (logs) {
      setValidLog(undefined);
      worker?.terminate();
      worker = new PlcValidateWorker();
      worker.onmessage = (e: MessageEvent<{ valid: boolean }>) => {
        setValidLog(e.data.valid);
        worker?.terminate();
        worker = undefined;
      };
      worker.postMessage({ did: props.did, logs });
    }
  });

  createEffect(() => {
    const hash = location.hash;
    if (hash.startsWith("#logs:")) {
      const createdAt = hash.slice(6);
      requestAnimationFrame(() => {
        const element = document.getElementById(`log-${createdAt}`);
        if (element) element.scrollIntoView({ behavior: "instant", block: "start" });
      });
    }
  });

  const EventFilter = () => (
    <div class="dark:hover:bg-dark-300 relative flex h-7 items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-50 px-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-100 has-[:focus-visible]:outline has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:has-[:focus-visible]:outline-neutral-500">
      <span aria-hidden="true">
        {plcEventFilters.find((filter) => filter.event === activePlcEvent())?.label}
      </span>
      <span
        aria-hidden="true"
        class="iconify lucide--chevron-down shrink-0 text-neutral-500 dark:text-neutral-400"
      />
      <select
        aria-label="Filter logs by event type"
        class="absolute inset-0 h-full w-full opacity-0"
        value={activePlcEvent() ?? ""}
        onChange={(event) =>
          setActivePlcEvent((event.currentTarget.value || undefined) as PlcEvent | undefined)
        }
      >
        <For each={plcEventFilters}>
          {(filter) => <option value={filter.event ?? ""}>{filter.label}</option>}
        </For>
      </select>
    </div>
  );

  const ValidationStatus = () => {
    const label = () =>
      validLog() === true
        ? "Valid log"
        : validLog() === false
          ? "Validation failed"
          : "Validating…";

    return (
      <div class="ml-auto flex shrink-0 items-center text-xs">
        <a
          href={`${plcDirectory()}/${props.did}/log/audit`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${label()}. Open audit log (opens in a new tab)`}
          class="flex h-7 items-center gap-1 rounded-sm text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
        >
          <span role="status" class="flex items-center gap-1">
            <span
              aria-hidden="true"
              class="iconify shrink-0"
              classList={{
                "lucide--check text-green-600 dark:text-green-400": validLog() === true,
                "lucide--x text-red-500 dark:text-red-400": validLog() === false,
                "lucide--loader-circle animate-spin": validLog() === undefined,
              }}
            />
            <span classList={{ "text-red-600 dark:text-red-400": validLog() === false }}>
              {label()}
            </span>
          </span>
          <span aria-hidden="true" class="iconify lucide--arrow-up-right shrink-0" />
        </a>
      </div>
    );
  };

  /** A service's short name, like "PDS", or its `#id` when it isn't under the usual one. */
  const serviceTitle = (type: string, id: string) => ({
    title: "Service",
    badge: hasStandardServiceId(type, id) ? serviceLabel(type) : `#${id}`,
  });

  const DiffItem = (props: { diff: DiffEntry }) => {
    const diff = props.diff;

    const getDiffConfig = () => {
      switch (diff.type) {
        case "identity_created":
          return { icon: "lucide--user-round-plus", title: "Identity created" };
        case "identity_tombstoned":
          return { icon: "lucide--skull", title: "Identity tombstoned" };
        case "handle_added":
          return {
            icon: "lucide--at-sign",
            title: "Alias",
            value: diff.handle,
            isAddition: true,
          };
        case "handle_removed":
          return {
            icon: "lucide--at-sign",
            title: "Alias",
            value: diff.handle,
            isRemoval: true,
          };
        case "handle_changed":
          return {
            icon: "lucide--at-sign",
            title: "Alias",
            oldValue: diff.prev_handle,
            newValue: diff.next_handle,
          };
        case "rotation_key_updated":
          return {
            icon: "lucide--key-round",
            title: "Rotation keys",
            keys: true,
            addedValues: diff.added_rotation_keys,
            removedValues: diff.removed_rotation_keys,
          };
        case "service_added":
          return {
            icon: "lucide--hard-drive",
            ...serviceTitle(diff.service_type, diff.service_id),
            value: diff.service_endpoint,
            isAddition: true,
          };
        case "service_removed":
          return {
            icon: "lucide--hard-drive",
            ...serviceTitle(diff.service_type, diff.service_id),
            value: diff.service_endpoint,
            isRemoval: true,
          };
        case "service_changed":
          return {
            icon: "lucide--hard-drive",
            ...serviceTitle(diff.next_service_type, diff.service_id),
            oldValue: diff.prev_service_endpoint,
            newValue: diff.next_service_endpoint,
          };
        case "verification_method_added":
          return {
            icon: "lucide--shield-check",
            title: "Verification method",
            badge: `#${diff.method_id}`,
            keys: true,
            value: diff.method_key,
            isAddition: true,
          };
        case "verification_method_removed":
          return {
            icon: "lucide--shield-check",
            title: "Verification method",
            badge: `#${diff.method_id}`,
            keys: true,
            value: diff.method_key,
            isRemoval: true,
          };
        case "verification_method_changed":
          return {
            icon: "lucide--shield-check",
            title: "Verification method",
            badge: `#${diff.method_id}`,
            keys: true,
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
      addedValues = [],
      removedValues = [],
      badge = "",
      keys = false,
      isAddition = false,
      isRemoval = false,
    } = config;

    const ValueRow = (props: {
      label: "Before" | "After" | "Added" | "Removed";
      value: string;
      muted?: boolean;
    }) => (
      <>
        <span
          class="self-center"
          classList={{
            "text-red-600 dark:text-red-300": props.label === "Before" || props.label === "Removed",
            "text-green-600 dark:text-green-300":
              props.label === "After" || props.label === "Added",
          }}
        >
          <span aria-hidden="true">
            {props.label === "After" || props.label === "Added" ? "+" : "−"}
          </span>
          <span class="sr-only">{props.label}</span>
        </span>
        <span
          class="truncate"
          classList={{
            "text-neutral-500/85 dark:text-neutral-400/85": props.muted,
            "text-neutral-700 dark:text-neutral-300": !props.muted,
          }}
        >
          {/* Keys read like the Identity tab's: their type, then the key without `did:key:`. */}
          <Show when={keys} fallback={props.value}>
            <span class={`${LABEL_COLUMN_CLASS} inline-block ${MUTED_CLASS}`}>
              {detectDidKeyType(props.value)}
            </span>
            <span class="font-mono">{props.value.replace("did:key:", "")}</span>
          </Show>
        </span>
      </>
    );

    return (
      <div
        classList={{
          "flex flex-col gap-y-0.5": true,
          "opacity-70": diff.orig.nullified,
        }}
      >
        {/* The icon hangs before the title, and the values below line up with the title text. */}
        <div class="flex min-w-0 items-baseline gap-1.5">
          <span
            aria-hidden="true"
            class={`${icon} iconify shrink-0 self-center text-neutral-500 dark:text-neutral-400`}
          />
          {/* Styled like the Identity tab's section headings, which name the same things. */}
          <p class={HEADING_TEXT_CLASS} classList={{ "line-through": diff.orig.nullified }}>
            {title}
          </p>
          <Show when={badge}>
            <span class="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">{badge}</span>
          </Show>
          <Show when={diff.orig.nullified}>
            <span class="ml-auto rounded bg-neutral-200 px-2 py-0.5 text-xs font-medium dark:bg-neutral-700">
              Nullified
            </span>
          </Show>
        </div>
        <Show when={value}>
          <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-1.5 pl-5 text-sm">
            <Show
              when={isAddition || isRemoval}
              fallback={<span class="col-span-2 truncate">{value}</span>}
            >
              <ValueRow label={isAddition ? "Added" : "Removed"} value={value} />
            </Show>
          </div>
        </Show>
        <Show when={oldValue && newValue}>
          <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-1.5 pl-5 text-sm">
            <ValueRow label="After" value={newValue} />
            <ValueRow label="Before" value={oldValue} muted />
          </div>
        </Show>
        <Show when={addedValues.length > 0 || removedValues.length > 0}>
          <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-1.5 pl-5 text-sm">
            <For each={addedValues}>
              {(addedValue) => <ValueRow label="Added" value={addedValue} />}
            </For>
            <For each={removedValues}>
              {(removedValue) => (
                <ValueRow label="Removed" value={removedValue} muted={addedValues.length > 0} />
              )}
            </For>
          </div>
        </Show>
      </div>
    );
  };

  return (
    <div class="flex w-full flex-col gap-3 wrap-anywhere">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <EventFilter />
        <ValidationStatus />
      </div>
      {/* A timeline: one dot per operation on a line, newest first. */}
      <ol class="flex flex-col">
        <For each={plcOps()}>
          {([entry, diffs]) => {
            const isHighlighted = () => location.hash === `#logs:${entry.createdAt}`;
            return (
              <Show when={shouldShowEntry(diffs)}>
                <li
                  id={`log-${entry.createdAt}`}
                  class="group/entry relative scroll-mt-3 pb-5 pl-5 last:pb-0"
                >
                  {/* The line runs from the first dot to the last, behind the dots. */}
                  <span
                    aria-hidden="true"
                    class="absolute top-0 bottom-0 left-[4.5px] w-px bg-neutral-300 group-first/entry:top-2 group-last/entry:bottom-auto group-last/entry:h-2 dark:bg-neutral-700"
                  />
                  <span
                    aria-hidden="true"
                    class="dark:ring-dark-500 absolute top-2 left-0 size-2.5 rounded-full ring-4 ring-neutral-100"
                    classList={{
                      "bg-neutral-400 dark:bg-neutral-500": !isHighlighted(),
                      "bg-blue-500 dark:bg-blue-400": isHighlighted(),
                    }}
                  />
                  <a
                    href={`#logs:${entry.createdAt}`}
                    class="text-xs font-medium tabular-nums hover:underline"
                    classList={{
                      "text-neutral-500 dark:text-neutral-400": !isHighlighted(),
                      "text-blue-500 dark:text-blue-400": isHighlighted(),
                    }}
                  >
                    {localDateFromTimestamp(new Date(entry.createdAt).getTime())}
                  </a>
                  <div class="mt-1.5 flex flex-col gap-2 text-sm">
                    <For each={diffs.filter(shouldShowDiff)}>
                      {(diff) => <DiffItem diff={diff} />}
                    </For>
                  </div>
                </li>
              </Show>
            );
          }}
        </For>
      </ol>
    </div>
  );
};
