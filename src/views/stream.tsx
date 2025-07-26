import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { JSONValue } from "../components/json";
import { A, useLocation, useSearchParams } from "@solidjs/router";
import { Firehose } from "@skyware/firehose";
import { TextInput } from "../components/text-input";

const LIMIT = 25;
type Parameter = { name: string; param: string | string[] | undefined };
enum StreamType {
  JETSTREAM,
  FIREHOSE,
}

const StreamView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [parameters, setParameters] = createSignal<Parameter[]>([]);
  const streamType =
    useLocation().pathname === "/firehose" ? StreamType.FIREHOSE : StreamType.JETSTREAM;

  const [records, setRecords] = createSignal<Array<any>>([]);
  const [connected, setConnected] = createSignal(false);
  const [allEvents, setAllEvents] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  let socket: WebSocket;
  let firehose: Firehose;
  let formRef!: HTMLFormElement;

  const connectSocket = async (formData: FormData) => {
    setNotice("");
    if (connected()) {
      if (streamType === StreamType.JETSTREAM) socket?.close();
      else firehose?.close();
      setConnected(false);
      return;
    }
    setRecords([]);

    let url = "";
    if (streamType === StreamType.JETSTREAM) {
      url =
        formData.get("instance")?.toString() ?? "wss://jetstream1.us-east.bsky.network/subscribe";
      url = url.concat("?");
    } else {
      url = formData.get("instance")?.toString() ?? "wss://bsky.network";
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
    if (streamType === StreamType.JETSTREAM) {
      if (cursor?.length) url = url.concat(`cursor=${cursor}`);
      if (url.endsWith("&")) url = url.slice(0, -1);
    }

    if (searchParams.allEvents === "on") setAllEvents(true);

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
    if (streamType === StreamType.JETSTREAM) {
      socket = new WebSocket(url);
      socket.addEventListener("message", (event) => {
        const rec = JSON.parse(event.data);
        if (allEvents() || (rec.kind !== "account" && rec.kind !== "identity"))
          setRecords(records().concat(rec).slice(-LIMIT));
      });
      socket.addEventListener("error", () => {
        setNotice("Connection error");
        setConnected(false);
      });
    } else {
      firehose = new Firehose({
        relay: url,
        cursor: cursor,
      });
      firehose.on("error", (err) => {
        console.error(err);
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
          setRecords(records().concat(record).slice(-LIMIT));
        }
      });
      firehose.on("identity", (identity) => {
        setRecords(records().concat(identity).slice(-LIMIT));
      });
      firehose.on("account", (account) => {
        setRecords(records().concat(account).slice(-LIMIT));
      });
      firehose.on("sync", (sync) => {
        const event = {
          $type: sync.$type,
          did: sync.did,
          rev: sync.rev,
          seq: sync.seq,
          time: sync.time,
        };
        setRecords(records().concat(event).slice(-LIMIT));
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

  onCleanup(() => socket?.close());

  return (
    <div class="mt-2 flex flex-col items-center gap-y-3">
      <div class="flex divide-x divide-neutral-500 font-bold">
        <A class="pr-2" inactiveClass="text-blue-400 hover:underline" href="/jetstream">
          Jetstream
        </A>
        <A class="pl-2" inactiveClass="text-blue-400 hover:underline" href="/firehose">
          Firehose
        </A>
      </div>
      <form ref={formRef} class="flex flex-col gap-y-2">
        <Show when={!connected()}>
          <label class="flex items-center justify-end gap-x-2">
            <span>Instance</span>
            <TextInput
              name="instance"
              value={
                searchParams.instance ??
                (streamType === StreamType.JETSTREAM ?
                  "wss://jetstream1.us-east.bsky.network/subscribe"
                : "wss://bsky.network")
              }
              class="w-16rem"
            />
          </label>
          <Show when={streamType === StreamType.JETSTREAM}>
            <label class="flex items-center justify-end gap-x-2">
              <span>Collections</span>
              <textarea
                name="collections"
                spellcheck={false}
                placeholder="Comma-separated list of collections"
                value={searchParams.collections ?? ""}
                class="w-16rem dark:bg-dark-100 focus:outline-1.5 rounded-lg bg-white px-2 py-1 shadow-sm focus:outline-blue-500"
              />
            </label>
          </Show>
          <Show when={streamType === StreamType.JETSTREAM}>
            <label class="flex items-center justify-end gap-x-2">
              <span>DIDs</span>
              <textarea
                name="dids"
                spellcheck={false}
                placeholder="Comma-separated list of DIDs"
                value={searchParams.dids ?? ""}
                class="w-16rem dark:bg-dark-100 focus:outline-1.5 rounded-lg bg-white px-2 py-1 shadow-sm focus:outline-blue-500"
              />
            </label>
          </Show>
          <label class="flex items-center justify-end gap-x-2">
            <span>Cursor</span>
            <TextInput
              name="cursor"
              placeholder="Leave empty for live-tail"
              value={searchParams.cursor ?? ""}
              class="w-16rem"
            />
          </label>
          <Show when={streamType === StreamType.JETSTREAM}>
            <div class="flex items-center justify-end gap-x-1">
              <input
                type="checkbox"
                name="allEvents"
                id="allEvents"
                checked={searchParams.allEvents === "on" ? true : false}
                onChange={(e) => setAllEvents(e.currentTarget.checked)}
              />
              <label for="allEvents" class="select-none">
                Show account and identity events
              </label>
            </div>
          </Show>
        </Show>
        <Show when={connected()}>
          <div class="break-anywhere flex flex-col gap-1">
            <For each={parameters()}>
              {(param) => (
                <Show when={param.param}>
                  <div class="flex">
                    <div class="min-w-6rem font-semibold text-stone-600 dark:text-stone-400">
                      {param.name}
                    </div>
                    {param.param}
                  </div>
                </Show>
              )}
            </For>
          </div>
        </Show>
        <div class="flex justify-end">
          <button
            type="button"
            onclick={() => connectSocket(new FormData(formRef))}
            class="dark:hover:bg-dark-100 dark:bg-dark-300 focus:outline-1.5 w-fit rounded-lg bg-white px-2 py-1.5 text-xs font-bold shadow-md hover:bg-zinc-200 focus:outline-blue-500"
          >
            {connected() ? "Disconnect" : "Connect"}
          </button>
        </div>
      </form>
      <Show when={notice().length}>
        <div class="text-red-500 dark:text-red-400">{notice()}</div>
      </Show>
      <div class="break-anywhere md:w-screen-md divide-y-0.5 flex h-screen w-full flex-col gap-2 divide-neutral-500 overflow-auto whitespace-pre-wrap pl-4 font-mono text-sm">
        <For each={records().toReversed()}>
          {(rec) => (
            <div class="pb-2">
              <JSONValue data={rec} repo={rec.did ?? rec.repo} />
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export { StreamView };
