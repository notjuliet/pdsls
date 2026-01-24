import { Firehose } from "@skyware/firehose";
import { Title } from "@solidjs/meta";
import { A, useLocation, useSearchParams } from "@solidjs/router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Button } from "../../components/button";
import DidHoverCard from "../../components/hover-card/did";
import { JSONValue } from "../../components/json";
import { TextInput } from "../../components/text-input";
import { addToClipboard } from "../../utils/copy";
import { getStreamType, STREAM_CONFIGS, STREAM_TYPES, StreamType } from "./config";
import { StreamStats, StreamStatsPanel } from "./stats";

const LIMIT = 20;

const TYPE_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  update: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  identity: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  account: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  sync: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
};

const StreamRecordItem = (props: { record: any; streamType: StreamType }) => {
  const [expanded, setExpanded] = createSignal(false);
  const config = () => STREAM_CONFIGS[props.streamType];
  const info = () => config().parseRecord(props.record);

  const displayType = () => {
    const i = info();
    return i.type === "commit" || i.type === "link" ? i.action : i.type;
  };

  const copyRecord = (e: MouseEvent) => {
    e.stopPropagation();
    addToClipboard(JSON.stringify(props.record, null, 2));
  };

  return (
    <div class="flex flex-col gap-2">
      <div class="flex items-start gap-1">
        <button
          type="button"
          onclick={() => setExpanded(!expanded())}
          class="dark:hover:bg-dark-200 flex min-w-0 flex-1 items-start gap-2 rounded p-1 text-left hover:bg-neutral-200/70"
        >
          <span class="mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500">
            {expanded() ?
              <span class="iconify lucide--chevron-down"></span>
            : <span class="iconify lucide--chevron-right"></span>}
          </span>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <div class="flex items-center gap-x-1.5 sm:gap-x-2">
              <span
                class={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_COLORS[displayType()!] || "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"}`}
              >
                {displayType()}
              </span>
              <Show when={info().collection && info().collection !== info().type}>
                <span class="min-w-0 truncate text-neutral-600 dark:text-neutral-300">
                  {info().collection}
                </span>
              </Show>
              <Show when={info().rkey}>
                <span class="shrink-0 text-neutral-400 dark:text-neutral-500">{info().rkey}</span>
              </Show>
            </div>
            <div class="flex flex-col gap-x-2 gap-y-0.5 text-xs text-neutral-500 sm:flex-row sm:items-center dark:text-neutral-400">
              <Show when={info().did}>
                <span class="w-fit" onclick={(e) => e.stopPropagation()}>
                  <DidHoverCard newTab did={info().did!} />
                </span>
              </Show>
              <Show when={info().time}>
                <span>{info().time}</span>
              </Show>
            </div>
          </div>
        </button>
        <Show when={expanded()}>
          <button
            type="button"
            onclick={copyRecord}
            class="flex size-6 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-600 active:bg-neutral-300 sm:size-7 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 dark:active:bg-neutral-600"
          >
            <span class="iconify lucide--copy"></span>
          </button>
        </Show>
      </div>
      <Show when={expanded()}>
        <div class="ml-6.5">
          <div class="w-full text-xs wrap-anywhere whitespace-pre-wrap md:w-2xl">
            <JSONValue newTab data={props.record} repo={info().did ?? ""} hideBlobs />
          </div>
        </div>
      </Show>
    </div>
  );
};

export const StreamView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const streamType = getStreamType(useLocation().pathname);
  const config = () => STREAM_CONFIGS[streamType];

  const [records, setRecords] = createSignal<any[]>([]);
  const [connected, setConnected] = createSignal(false);
  const [paused, setPaused] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [parameters, setParameters] = createSignal<{ name: string; value?: string }[]>([]);
  const [stats, setStats] = createSignal<StreamStats>({
    totalEvents: 0,
    eventsPerSecond: 0,
    eventTypes: {},
    collections: {},
  });
  const [currentTime, setCurrentTime] = createSignal(Date.now());

  let socket: WebSocket;
  let firehose: Firehose;
  let formRef!: HTMLFormElement;
  let pendingRecords: any[] = [];
  let rafId: number | null = null;
  let statsIntervalId: number | null = null;
  let statsUpdateIntervalId: number | null = null;
  let currentSecondEventCount = 0;
  let totalEventsCount = 0;
  let eventTypesMap: Record<string, number> = {};
  let collectionsMap: Record<string, number> = {};

  const addRecord = (record: any) => {
    currentSecondEventCount++;
    totalEventsCount++;

    const rawEventType = record.kind || record.$type || "unknown";
    const eventType = rawEventType.includes("#") ? rawEventType.split("#").pop() : rawEventType;
    eventTypesMap[eventType] = (eventTypesMap[eventType] || 0) + 1;

    if (eventType !== "account" && eventType !== "identity") {
      const collection =
        record.commit?.collection ||
        record.op?.path?.split("/")[0] ||
        record.link?.source ||
        "unknown";
      collectionsMap[collection] = (collectionsMap[collection] || 0) + 1;
    }

    if (!paused()) {
      pendingRecords.push(record);
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          setRecords(records().concat(pendingRecords).slice(-LIMIT));
          pendingRecords = [];
          rafId = null;
        });
      }
    }
  };

  const disconnect = () => {
    if (!config().useFirehoseLib) socket?.close();
    else firehose?.close();

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (statsIntervalId !== null) {
      clearInterval(statsIntervalId);
      statsIntervalId = null;
    }
    if (statsUpdateIntervalId !== null) {
      clearInterval(statsUpdateIntervalId);
      statsUpdateIntervalId = null;
    }

    pendingRecords = [];
    totalEventsCount = 0;
    eventTypesMap = {};
    collectionsMap = {};
    setConnected(false);
    setPaused(false);
    setStats((prev) => ({ ...prev, eventsPerSecond: 0 }));
  };

  const connectStream = async (formData: FormData) => {
    setNotice("");
    if (connected()) {
      disconnect();
      return;
    }
    setRecords([]);

    const instance = formData.get("instance")?.toString() ?? config().defaultInstance;
    const url = config().buildUrl(instance, formData);

    // Save all form fields to URL params
    const params: Record<string, string | undefined> = { instance };
    config().fields.forEach((field) => {
      params[field.searchParam] = formData.get(field.name)?.toString();
    });
    setSearchParams(params);

    // Build parameters display
    setParameters([
      { name: "Instance", value: instance },
      ...config()
        .fields.filter((f) => f.type !== "checkbox")
        .map((f) => ({ name: f.label, value: formData.get(f.name)?.toString() })),
      ...config()
        .fields.filter((f) => f.type === "checkbox" && formData.get(f.name) === "on")
        .map((f) => ({ name: f.label, value: "on" })),
    ]);

    setConnected(true);
    const now = Date.now();
    setCurrentTime(now);

    totalEventsCount = 0;
    eventTypesMap = {};
    collectionsMap = {};

    setStats({
      connectedAt: now,
      totalEvents: 0,
      eventsPerSecond: 0,
      eventTypes: {},
      collections: {},
    });

    statsUpdateIntervalId = window.setInterval(() => {
      setStats((prev) => ({
        ...prev,
        totalEvents: totalEventsCount,
        eventTypes: { ...eventTypesMap },
        collections: { ...collectionsMap },
      }));
    }, 50);

    statsIntervalId = window.setInterval(() => {
      setStats((prev) => ({ ...prev, eventsPerSecond: currentSecondEventCount }));
      currentSecondEventCount = 0;
      setCurrentTime(Date.now());
    }, 1000);

    if (!config().useFirehoseLib) {
      socket = new WebSocket(url);
      socket.addEventListener("message", (event) => {
        const rec = JSON.parse(event.data);
        const isFilteredEvent = rec.kind === "account" || rec.kind === "identity";
        if (!isFilteredEvent || streamType !== "jetstream" || searchParams.allEvents === "on")
          addRecord(rec);
      });
      socket.addEventListener("error", () => {
        setNotice("Connection error");
        disconnect();
      });
    } else {
      const cursor = formData.get("cursor")?.toString();
      firehose = new Firehose({
        relay: url,
        cursor: cursor,
        autoReconnect: false,
      });
      firehose.on("error", (err) => {
        console.error(err);
        const message = err instanceof Error ? err.message : "Unknown error";
        setNotice(`Connection error: ${message}`);
        disconnect();
      });
      firehose.on("commit", (commit) => {
        for (const op of commit.ops) {
          addRecord({
            $type: commit.$type,
            repo: commit.repo,
            seq: commit.seq,
            time: commit.time,
            rev: commit.rev,
            since: commit.since,
            op: op,
          });
        }
      });
      firehose.on("identity", (identity) => addRecord(identity));
      firehose.on("account", (account) => addRecord(account));
      firehose.on("sync", (sync) => {
        addRecord({
          $type: sync.$type,
          did: sync.did,
          rev: sync.rev,
          seq: sync.seq,
          time: sync.time,
        });
      });
      firehose.start();
    }
  };

  onMount(() => {
    if (searchParams.instance) {
      const formData = new FormData();
      formData.append("instance", searchParams.instance.toString());
      config().fields.forEach((field) => {
        const value = searchParams[field.searchParam];
        if (value) formData.append(field.name, value.toString());
      });
      connectStream(formData);
    }
  });

  onCleanup(() => {
    socket?.close();
    firehose?.close();
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (statsIntervalId !== null) clearInterval(statsIntervalId);
    if (statsUpdateIntervalId !== null) clearInterval(statsUpdateIntervalId);
  });

  return (
    <>
      <Title>{config().label} - PDSls</Title>
      <div class="flex w-full flex-col items-center gap-2">
        {/* Tab Navigation */}
        <div class="flex gap-4 font-medium">
          <For each={STREAM_TYPES}>
            {(type) => (
              <A
                class="flex items-center gap-1 border-b-2"
                inactiveClass="border-transparent text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600"
                href={`/${type}`}
              >
                {STREAM_CONFIGS[type].label}
              </A>
            )}
          </For>
        </div>

        {/* Stream Description */}
        <div class="w-full px-2 text-center">
          <p class="text-sm text-neutral-600 dark:text-neutral-400">{config().description}</p>
        </div>

        {/* Connection Form */}
        <Show when={!connected()}>
          <form ref={formRef} class="flex w-full flex-col gap-2 p-2 text-sm">
            <label class="flex items-center justify-end gap-x-1">
              <span class="min-w-21 select-none">Instance</span>
              <TextInput
                name="instance"
                value={searchParams.instance ?? config().defaultInstance}
                class="grow"
              />
            </label>

            <For each={config().fields}>
              {(field) => (
                <label class="flex items-center justify-end gap-x-1">
                  <Show when={field.type === "checkbox"}>
                    <input
                      type="checkbox"
                      name={field.name}
                      id={field.name}
                      checked={searchParams[field.searchParam] === "on"}
                    />
                  </Show>
                  <span class="min-w-21 select-none">{field.label}</span>
                  <Show when={field.type === "textarea"}>
                    <textarea
                      name={field.name}
                      spellcheck={false}
                      placeholder={field.placeholder}
                      value={(searchParams[field.searchParam] as string) ?? ""}
                      class="dark:bg-dark-100 grow rounded-lg bg-white px-2 py-1 outline-1 outline-neutral-200 focus:outline-[1.5px] focus:outline-neutral-600 dark:outline-neutral-600 dark:focus:outline-neutral-400"
                    />
                  </Show>
                  <Show when={field.type === "text"}>
                    <TextInput
                      name={field.name}
                      placeholder={field.placeholder}
                      value={(searchParams[field.searchParam] as string) ?? ""}
                      class="grow"
                    />
                  </Show>
                </label>
              )}
            </For>

            <div class="flex justify-end gap-2">
              <Button onClick={() => connectStream(new FormData(formRef))}>Connect</Button>
            </div>
          </form>
        </Show>

        {/* Connected State */}
        <Show when={connected()}>
          <div class="flex w-full flex-col gap-2 p-2">
            <div class="flex flex-col gap-1 text-sm wrap-anywhere">
              <div class="font-semibold">Parameters</div>
              <For each={parameters()}>
                {(param) => (
                  <Show when={param.value}>
                    <div class="text-sm">
                      <div class="text-xs text-neutral-500 dark:text-neutral-400">{param.name}</div>
                      <div class="text-neutral-700 dark:text-neutral-300">{param.value}</div>
                    </div>
                  </Show>
                )}
              </For>
            </div>
            <StreamStatsPanel
              stats={stats()}
              currentTime={currentTime()}
              streamType={streamType}
              showAllEvents={searchParams.allEvents === "on"}
            />
            <div class="flex justify-end gap-2">
              <Button
                ontouchstart={(e) => {
                  e.preventDefault();
                  requestAnimationFrame(() => setPaused(!paused()));
                }}
                onClick={() => setPaused(!paused())}
              >
                {paused() ? "Resume" : "Pause"}
              </Button>
              <Button
                ontouchstart={(e) => {
                  e.preventDefault();
                  requestAnimationFrame(() => disconnect());
                }}
                onClick={disconnect}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </Show>

        {/* Error Notice */}
        <Show when={notice().length}>
          <div class="text-red-500 dark:text-red-400">{notice()}</div>
        </Show>

        {/* Records List */}
        <Show when={connected() || records().length > 0}>
          <div class="flex min-h-280 w-full flex-col gap-2 font-mono text-xs [overflow-anchor:auto] sm:text-sm">
            <For each={records().toReversed()}>
              {(rec) => (
                <div class="[overflow-anchor:none]">
                  <StreamRecordItem record={rec} streamType={streamType} />
                </div>
              )}
            </For>
            <div class="h-px [overflow-anchor:auto]" />
          </div>
        </Show>
      </div>
    </>
  );
};
