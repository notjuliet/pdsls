import { Firehose } from "@skyware/firehose";
import { Title } from "@solidjs/meta";
import { A, useLocation, useSearchParams } from "@solidjs/router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Button } from "../../components/button";
import { JSONValue } from "../../components/json";
import { StickyOverlay } from "../../components/sticky";
import { TextInput } from "../../components/text-input";
import { StreamStats, StreamStatsPanel } from "./stats";

const LIMIT = 20;
type Parameter = { name: string; param: string | string[] | undefined };

const StreamView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [parameters, setParameters] = createSignal<Parameter[]>([]);
  const streamType = useLocation().pathname === "/firehose" ? "firehose" : "jetstream";
  const [records, setRecords] = createSignal<Array<any>>([]);
  const [connected, setConnected] = createSignal(false);
  const [paused, setPaused] = createSignal(false);
  const [notice, setNotice] = createSignal("");
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
  let lastSecondEventCount = 0;
  let currentSecondEventCount = 0;
  // Track stats in variables for batching
  let totalEventsCount = 0;
  let eventTypesMap: Record<string, number> = {};
  let collectionsMap: Record<string, number> = {};

  const addRecord = (record: any) => {
    currentSecondEventCount++;

    // Track statistics in variables (batched update)
    totalEventsCount++;
    const eventType = record.kind || record.$type || "unknown";
    const collection = record.commit?.collection || record.op?.path?.split("/")[0] || "unknown";
    eventTypesMap[eventType] = (eventTypesMap[eventType] || 0) + 1;
    collectionsMap[collection] = (collectionsMap[collection] || 0) + 1;

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
    if (streamType === "jetstream") socket?.close();
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
    setStats((prev) => ({
      ...prev,
      eventsPerSecond: 0,
    }));
  };

  const togglePause = () => {
    setPaused(!paused());
  };

  const connectSocket = async (formData: FormData) => {
    setNotice("");
    if (connected()) {
      disconnect();
      return;
    }
    setRecords([]);

    let url = "";
    if (streamType === "jetstream") {
      url =
        formData.get("instance")?.toString() ?? "wss://jetstream1.us-east.bsky.network/subscribe";
      url = url.concat("?");
    } else {
      url = formData.get("instance")?.toString() ?? "wss://bsky.network";
      url = url.replace("/xrpc/com.atproto.sync.subscribeRepos", "");
      if (!(url.startsWith("wss://") || url.startsWith("ws://"))) url = "wss://" + url;
    }

    const collections = formData.get("collections")?.toString().split(",");
    collections?.forEach((collection) => {
      if (collection.length) url = url.concat(`wantedCollections=${collection}&`);
    });

    const dids = formData.get("dids")?.toString().split(",");
    dids?.forEach((did) => {
      if (did.length) url = url.concat(`wantedDids=${did}&`);
    });

    const cursor = formData.get("cursor")?.toString();
    if (streamType === "jetstream") {
      if (cursor?.length) url = url.concat(`cursor=${cursor}`);
      if (url.endsWith("&")) url = url.slice(0, -1);
    }

    setSearchParams({
      instance: formData.get("instance")?.toString(),
      collections: formData.get("collections")?.toString(),
      dids: formData.get("dids")?.toString(),
      cursor: formData.get("cursor")?.toString(),
      allEvents: formData.get("allEvents")?.toString(),
    });

    setParameters([
      { name: "Instance", param: formData.get("instance")?.toString() },
      { name: "Collections", param: formData.get("collections")?.toString() },
      { name: "DIDs", param: formData.get("dids")?.toString() },
      { name: "Cursor", param: formData.get("cursor")?.toString() },
      { name: "All Events", param: formData.get("allEvents")?.toString() },
    ]);

    setConnected(true);
    const now = Date.now();
    setCurrentTime(now);

    // Reset tracking variables
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

    // Calculate events/sec every second
    statsIntervalId = window.setInterval(() => {
      setStats((prev) => ({
        ...prev,
        eventsPerSecond: currentSecondEventCount,
      }));
      lastSecondEventCount = currentSecondEventCount;
      currentSecondEventCount = 0;
      setCurrentTime(Date.now());
    }, 1000);
    if (streamType === "jetstream") {
      socket = new WebSocket(url);
      socket.addEventListener("message", (event) => {
        const rec = JSON.parse(event.data);
        if (searchParams.allEvents === "on" || (rec.kind !== "account" && rec.kind !== "identity"))
          addRecord(rec);
      });
      socket.addEventListener("error", () => {
        setNotice("Connection error");
        disconnect();
      });
    } else {
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
          const record = {
            $type: commit.$type,
            repo: commit.repo,
            seq: commit.seq,
            time: commit.time,
            rev: commit.rev,
            since: commit.since,
            op: op,
          };
          addRecord(record);
        }
      });
      firehose.on("identity", (identity) => {
        addRecord(identity);
      });
      firehose.on("account", (account) => {
        addRecord(account);
      });
      firehose.on("sync", (sync) => {
        const event = {
          $type: sync.$type,
          did: sync.did,
          rev: sync.rev,
          seq: sync.seq,
          time: sync.time,
        };
        addRecord(event);
      });
      firehose.start();
    }
  };

  onMount(async () => {
    const formData = new FormData();
    if (searchParams.instance) formData.append("instance", searchParams.instance.toString());
    if (searchParams.collections)
      formData.append("collections", searchParams.collections.toString());
    if (searchParams.dids) formData.append("dids", searchParams.dids.toString());
    if (searchParams.cursor) formData.append("cursor", searchParams.cursor.toString());
    if (searchParams.allEvents) formData.append("allEvents", searchParams.allEvents.toString());
    if (searchParams.instance) connectSocket(formData);
  });

  onCleanup(() => {
    socket?.close();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    if (statsIntervalId !== null) {
      clearInterval(statsIntervalId);
    }
    if (statsUpdateIntervalId !== null) {
      clearInterval(statsUpdateIntervalId);
    }
  });

  return (
    <>
      <Title>{streamType === "firehose" ? "Firehose" : "Jetstream"} - PDSls</Title>
      <div class="flex w-full flex-col items-center">
        <div class="flex gap-4 font-medium">
          <A
            class="flex items-center gap-1 border-b-2"
            inactiveClass="border-transparent text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600"
            href="/jetstream"
          >
            Jetstream
          </A>
          <A
            class="flex items-center gap-1 border-b-2"
            inactiveClass="border-transparent text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600"
            href="/firehose"
          >
            Firehose
          </A>
        </div>
        <Show when={!connected()}>
          <form ref={formRef} class="mt-4 mb-4 flex w-full flex-col gap-1.5 px-2 text-sm">
            <label class="flex items-center justify-end gap-x-1">
              <span class="min-w-20">Instance</span>
              <TextInput
                name="instance"
                value={
                  searchParams.instance ??
                  (streamType === "jetstream" ?
                    "wss://jetstream1.us-east.bsky.network/subscribe"
                  : "wss://bsky.network")
                }
                class="grow"
              />
            </label>
            <Show when={streamType === "jetstream"}>
              <label class="flex items-center justify-end gap-x-1">
                <span class="min-w-20">Collections</span>
                <textarea
                  name="collections"
                  spellcheck={false}
                  placeholder="Comma-separated list of collections"
                  value={searchParams.collections ?? ""}
                  class="dark:bg-dark-100 grow rounded-lg bg-white px-2 py-1 outline-1 outline-neutral-200 focus:outline-[1.5px] focus:outline-neutral-600 dark:outline-neutral-600 dark:focus:outline-neutral-400"
                />
              </label>
            </Show>
            <Show when={streamType === "jetstream"}>
              <label class="flex items-center justify-end gap-x-1">
                <span class="min-w-20">DIDs</span>
                <textarea
                  name="dids"
                  spellcheck={false}
                  placeholder="Comma-separated list of DIDs"
                  value={searchParams.dids ?? ""}
                  class="dark:bg-dark-100 grow rounded-lg bg-white px-2 py-1 outline-1 outline-neutral-200 focus:outline-[1.5px] focus:outline-neutral-600 dark:outline-neutral-600 dark:focus:outline-neutral-400"
                />
              </label>
            </Show>
            <label class="flex items-center justify-end gap-x-1">
              <span class="min-w-20">Cursor</span>
              <TextInput
                name="cursor"
                placeholder="Leave empty for live-tail"
                value={searchParams.cursor ?? ""}
                class="grow"
              />
            </label>
            <Show when={streamType === "jetstream"}>
              <div class="flex items-center justify-end gap-x-1">
                <input
                  type="checkbox"
                  name="allEvents"
                  id="allEvents"
                  checked={searchParams.allEvents === "on" ? true : false}
                />
                <label for="allEvents" class="select-none">
                  Show account and identity events
                </label>
              </div>
            </Show>
            <div class="flex justify-end gap-2">
              <Button onClick={() => connectSocket(new FormData(formRef))}>Connect</Button>
            </div>
          </form>
        </Show>
        <Show when={connected()}>
          <StickyOverlay>
            <div class="flex w-full flex-col gap-2 p-1">
              <div class="flex flex-col gap-1 text-sm wrap-anywhere">
                <div class="font-semibold">Parameters</div>
                <For each={parameters()}>
                  {(param) => (
                    <Show when={param.param}>
                      <div class="text-sm">
                        <div class="text-xs text-neutral-500 dark:text-neutral-400">
                          {param.name}
                        </div>
                        <div class="text-neutral-700 dark:text-neutral-300">{param.param}</div>
                      </div>
                    </Show>
                  )}
                </For>
              </div>
              <StreamStatsPanel stats={stats()} currentTime={currentTime()} />
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  ontouchstart={(e) => {
                    e.preventDefault();
                    requestAnimationFrame(() => togglePause());
                  }}
                  onclick={togglePause}
                  class="dark:hover:bg-dark-200 dark:shadow-dark-700 dark:active:bg-dark-100 box-border flex h-7 items-center gap-1 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs shadow-xs select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  {paused() ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  ontouchstart={(e) => {
                    e.preventDefault();
                    requestAnimationFrame(() => disconnect());
                  }}
                  onclick={disconnect}
                  class="dark:hover:bg-dark-200 dark:shadow-dark-700 dark:active:bg-dark-100 box-border flex h-7 items-center gap-1 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs shadow-xs select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </StickyOverlay>
        </Show>
        <Show when={notice().length}>
          <div class="text-red-500 dark:text-red-400">{notice()}</div>
        </Show>
        <div class="flex w-full flex-col gap-2 divide-y-[0.5px] divide-neutral-500 font-mono text-sm wrap-anywhere whitespace-pre-wrap md:w-3xl">
          <For each={records().toReversed()}>
            {(rec) => (
              <div class="pb-2">
                <JSONValue data={rec} repo={rec.did ?? rec.repo} />
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  );
};

export { StreamView };
