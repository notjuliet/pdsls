import { Firehose } from "@skyware/firehose";
import { A, useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { Button } from "../../components/button";
import DidHoverCard from "../../components/hover-card/did";
import { JSONValue } from "../../components/json";
import { TagInput } from "../../components/tag-input";
import { TextInput } from "../../components/text-input";
import { addToClipboard } from "../../utils/copy";
import { websocketCloseReasons } from "../../utils/websocket";
import { getStreamType, STREAM_CONFIGS, STREAM_TYPES, StreamType } from "./config";
import { StreamStats, StreamStatsPanel } from "./stats";

const LIMIT = 20;

const microsToDatetimeLocal = (micros: string): string => {
  const ms = Math.floor(Number(micros) / 1000);
  if (isNaN(ms)) return "";
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const datetimeLocalToMicros = (dt: string): string => {
  if (!dt) return "";
  return (new Date(dt).getTime() * 1000).toString();
};

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
          class="dark:hover:bg-dark-200 flex min-w-0 flex-1 items-start gap-2 px-2 py-2 text-left transition-colors hover:bg-blue-50 active:bg-blue-100/70"
        >
          <span class="mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500">
            {expanded() ? (
              <span class="iconify lucide--chevron-down"></span>
            ) : (
              <span class="iconify lucide--chevron-right"></span>
            )}
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
                <span class="truncate text-neutral-400 dark:text-neutral-500">{info().rkey}</span>
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
            class="mt-2 mr-2 flex size-6 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-blue-50 hover:text-neutral-600 active:bg-blue-100 sm:size-7 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300 dark:active:bg-neutral-600"
          >
            <span class="iconify lucide--copy"></span>
          </button>
        </Show>
      </div>
      <Show when={expanded()}>
        <div class="mr-2 mb-2 ml-8">
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
  const streamType = createMemo(() => getStreamType(searchParams.type));
  const config = () => STREAM_CONFIGS[streamType()];

  const [records, setRecords] = createSignal<any[]>([]);
  const [connected, setConnected] = createSignal(false);
  const [paused, setPaused] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [parameters, setParameters] = createSignal<{ name: string; value?: string }[]>([]);
  const [connectedPanel, setConnectedPanel] = createSignal<"statistics" | "options">("statistics");
  const [stats, setStats] = createSignal<StreamStats>({
    totalEvents: 0,
    eventsPerSecond: 0,
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
  let collectionsMap: Record<string, number> = {};

  const shouldShowTopCollections = () =>
    streamType() !== "jetstream" ||
    searchParams.collections
      ?.toString()
      .split(",")
      .filter((collection) => collection.trim()).length !== 1;

  const addRecord = (record: any) => {
    currentSecondEventCount++;
    totalEventsCount++;

    const rawEventType = record.kind || record.$type || "unknown";
    const eventType = rawEventType.includes("#") ? rawEventType.split("#").pop() : rawEventType;

    if (eventType !== "account" && eventType !== "identity" && eventType !== "sync") {
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
    socket?.close();
    firehose?.close();

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
    currentSecondEventCount = 0;
    collectionsMap = {};
    setConnected(false);
    setPaused(false);
    setStats((prev) => ({ ...prev, eventsPerSecond: 0 }));
  };

  const onWebsocketClose = (event: CloseEvent) => {
    const code = event.code.toString();
    if (code === "1000" || code === "1005") return;

    setNotice(`Connection closed: ${websocketCloseReasons[code] ?? "Unknown reason"}`);
    disconnect();
  };

  const connectStream = async (formData: FormData) => {
    setNotice("");
    if (connected()) {
      disconnect();
      return;
    }
    setRecords([]);
    setConnectedPanel("statistics");

    const instance = formData.get("instance")?.toString() ?? config().defaultInstance;
    const url = config().buildUrl(instance, formData);

    // Save all form fields to URL params
    const params: Record<string, string | undefined> = { type: streamType(), instance };
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
        .map((f) => ({ name: f.label, value: "Enabled" })),
    ]);

    setConnected(true);
    const now = Date.now();
    setCurrentTime(now);

    totalEventsCount = 0;
    collectionsMap = {};

    setStats({
      connectedAt: now,
      totalEvents: 0,
      eventsPerSecond: 0,
      collections: {},
    });

    statsUpdateIntervalId = window.setInterval(() => {
      setStats((prev) => ({
        ...prev,
        totalEvents: totalEventsCount,
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
        if (!isFilteredEvent || streamType() !== "jetstream" || searchParams.allEvents === "on")
          addRecord(rec);
      });
      socket.addEventListener("close", onWebsocketClose);
      socket.addEventListener("error", () => {
        socket.removeEventListener("close", onWebsocketClose);
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
      firehose.ws.addEventListener("close", onWebsocketClose);
      firehose.on("error", (err) => {
        firehose.ws.removeEventListener("close", onWebsocketClose);
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

  createEffect(
    on(
      streamType,
      (_type, previousType) => {
        if (!previousType) return;
        if (connected()) disconnect();
        setRecords([]);
        setNotice("");
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    socket?.close();
    firehose?.close();
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (statsIntervalId !== null) clearInterval(statsIntervalId);
    if (statsUpdateIntervalId !== null) clearInterval(statsUpdateIntervalId);
  });

  createEffect(() => {
    document.title = `${config().label} - PDSls`;
  });
  return (
    <div class="flex w-full flex-col gap-3">
      <nav
        aria-label="Stream type"
        class="grid grid-cols-3 border-b border-neutral-200 text-sm dark:border-neutral-700"
      >
        <For each={STREAM_TYPES}>
          {(type) => (
            <A
              end
              class="flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2 transition-colors"
              classList={{
                "border-neutral-700 text-neutral-900 dark:border-neutral-200 dark:text-neutral-100":
                  streamType() === type,
                "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200":
                  streamType() !== type,
              }}
              href={`/streams?type=${type}`}
            >
              <span class={`iconify ${STREAM_CONFIGS[type].icon} shrink-0`} />
              <span class="truncate">{STREAM_CONFIGS[type].label}</span>
            </A>
          )}
        </For>
      </nav>

      <div class="flex w-full flex-col gap-2">
        <p class="px-1 text-xs text-neutral-500 dark:text-neutral-400">{config().description}</p>

        <section class="w-full rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
          <Show when={!connected()}>
            <form
              ref={formRef}
              class="flex w-full flex-col gap-4 p-3 text-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void connectStream(new FormData(formRef));
              }}
            >
              <label class="flex flex-col gap-1">
                <span class="font-medium">Instance</span>
                <TextInput
                  name="instance"
                  value={searchParams.instance ?? config().defaultInstance}
                  class="w-full"
                />
              </label>

              <Show when={config().fields.some((field) => field.type !== "checkbox")}>
                <div class="flex flex-col gap-3">
                  <For each={config().fields.filter((field) => field.type !== "checkbox")}>
                    {(field) => {
                      let inputRef!: HTMLInputElement;
                      let pickerRef!: HTMLInputElement;
                      return (
                        <label class="flex flex-col gap-1">
                          <span class="font-medium">{field.label}</span>
                          <Show when={field.type === "tags"}>
                            <TagInput
                              name={field.name}
                              placeholder={field.placeholder}
                              initialValues={
                                (searchParams[field.searchParam] as string)
                                  ?.split(",")
                                  .filter((v) => v.trim().length > 0) ?? []
                              }
                            />
                          </Show>

                          <Show when={field.type === "text"}>
                            <div class="flex flex-wrap items-center gap-1.5">
                              <TextInput
                                ref={inputRef}
                                name={field.name}
                                placeholder={field.placeholder}
                                value={(searchParams[field.searchParam] as string) ?? ""}
                                class="min-w-0 grow basis-44"
                                onInput={() => {
                                  if (field.datetimePicker && pickerRef) {
                                    pickerRef.value = microsToDatetimeLocal(inputRef.value);
                                  }
                                }}
                              />
                              <Show when={field.datetimePicker}>
                                <input
                                  ref={pickerRef}
                                  type="datetime-local"
                                  step="1"
                                  value={microsToDatetimeLocal(
                                    (searchParams[field.searchParam] as string) ??
                                      (Date.now() * 1000).toString(),
                                  )}
                                  class="dark:bg-dark-100 min-w-0 grow basis-44 rounded-md bg-white px-2 py-1 text-sm outline-1 outline-neutral-200 select-none focus:outline-neutral-400 dark:scheme-dark dark:outline-neutral-600 dark:focus:outline-neutral-400"
                                  onInput={(e) => {
                                    const micros = datetimeLocalToMicros(e.currentTarget.value);
                                    inputRef.value = micros;
                                  }}
                                />
                              </Show>
                            </div>
                          </Show>
                        </label>
                      );
                    }}
                  </For>
                </div>
              </Show>

              <div class="flex flex-wrap items-center gap-2 pt-1">
                <For each={config().fields.filter((field) => field.type === "checkbox")}>
                  {(field) => (
                    <label class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name={field.name}
                        id={field.name}
                        checked={searchParams[field.searchParam] === "on"}
                      />
                      <span class="select-none">{field.label}</span>
                    </label>
                  )}
                </For>
                <div class="ml-auto">
                  <Button type="submit">
                    <span class="iconify lucide--radio" />
                    Connect
                  </Button>
                </div>
              </div>
            </form>
          </Show>

          <Show when={connected()}>
            <div class="flex w-full flex-col gap-3 p-3">
              <div
                role="tablist"
                aria-label="Connection information"
                class="flex gap-4 border-b border-neutral-200 text-sm dark:border-neutral-700"
              >
                <For each={["statistics", "options"] as const}>
                  {(panel) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={connectedPanel() === panel}
                      class="border-b-2 pb-1 font-medium transition-colors"
                      classList={{
                        "border-neutral-700 text-neutral-900 dark:border-neutral-200 dark:text-neutral-100":
                          connectedPanel() === panel,
                        "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200":
                          connectedPanel() !== panel,
                      }}
                      onClick={() => setConnectedPanel(panel)}
                    >
                      {panel === "statistics" ? "Statistics" : "Options"}
                    </button>
                  )}
                </For>
              </div>

              <div>
                <Show when={connectedPanel() === "statistics"}>
                  <StreamStatsPanel
                    stats={stats()}
                    currentTime={currentTime()}
                    streamType={streamType()}
                    showCollections={shouldShowTopCollections()}
                  />
                </Show>

                <Show when={connectedPanel() === "options"}>
                  <div class="grid gap-2 text-sm wrap-anywhere">
                    <For each={parameters()}>
                      {(param) => (
                        <Show when={param.value}>
                          <div class="min-w-0">
                            <div class="text-xs text-neutral-500 dark:text-neutral-400">
                              {param.name}
                            </div>
                            <div class="text-neutral-700 dark:text-neutral-300">{param.value}</div>
                          </div>
                        </Show>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </section>
      </div>

      <Show when={notice().length}>
        <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {notice()}
        </div>
      </Show>

      <Show when={connected() || records().length > 0}>
        <section class="flex w-full flex-col gap-2">
          <div class="flex items-center justify-between px-1">
            <h2 class="text-sm font-medium">Events</h2>
            <Show when={connected()}>
              <div class="flex gap-2">
                <Button
                  ontouchstart={(e) => {
                    e.preventDefault();
                    requestAnimationFrame(() => setPaused(!paused()));
                  }}
                  onClick={() => setPaused(!paused())}
                >
                  <span class={`iconify ${paused() ? "lucide--play" : "lucide--pause"}`} />
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
            </Show>
          </div>
          <Show
            when={records().length > 0}
            fallback={
              <div class="rounded-lg border border-neutral-200 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                Waiting for events…
              </div>
            }
          >
            <div class="w-full divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 font-mono text-xs [overflow-anchor:auto] sm:text-sm dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800">
              <For each={records().toReversed()}>
                {(rec) => (
                  <div class="[overflow-anchor:none]">
                    <StreamRecordItem record={rec} streamType={streamType()} />
                  </div>
                )}
              </For>
              <div class="h-px [overflow-anchor:auto]" />
            </div>
          </Show>
        </section>
      </Show>
    </div>
  );
};

export const LegacyStreamRedirect = () => {
  const location = useLocation();
  const navigate = useNavigate();

  onMount(() => {
    const params = new URLSearchParams(location.search);
    params.set("type", getStreamType(location.pathname.slice(1)));
    navigate(`/streams?${params.toString()}`, { replace: true });
  });

  return null;
};
