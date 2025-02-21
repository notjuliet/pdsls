import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { JSONValue } from "../components/json";
import { action, useAction, useSearchParams } from "@solidjs/router";

const LIMIT = 25;
type Parameter = { name: string; param: string | string[] | undefined };

const JetstreamView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [parameters, setParameters] = createSignal<Parameter[]>([]);

  const [records, setRecords] = createSignal<Array<any>>([]);
  const [connected, setConnected] = createSignal(false);
  const [allEvents, setAllEvents] = createSignal(false);
  let socket: WebSocket;

  const connectSocket = action(async (formData: FormData) => {
    if (connected()) {
      socket?.close();
      setConnected(false);
      return;
    }
    setRecords([]);

    let url =
      formData.get("instance")?.toString() ??
      "wss://jetstream1.us-east.bsky.network/subscribe";
    url = url.concat("?");

    const collections = formData.get("collections")?.toString().split(",");
    collections?.forEach((collection) => {
      if (collection.length)
        url = url.concat(`wantedCollections=${collection}&`);
    });

    const dids = formData.get("dids")?.toString().split(",");
    dids?.forEach((did) => {
      if (did.length) url = url.concat(`wantedDids=${did}&`);
    });

    const cursor = formData.get("cursor")?.toString();
    if (cursor?.length) url = url.concat(`cursor=${cursor}`);
    if (url.endsWith("&")) url = url.slice(0, -1);

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

    socket = new WebSocket(url);
    setConnected(true);
    socket.addEventListener("message", (event) => {
      const rec = JSON.parse(event.data);
      if (allEvents() || (rec.kind !== "account" && rec.kind !== "identity"))
        setRecords(records().concat(rec).slice(-LIMIT));
    });
  });

  const connect = useAction(connectSocket);

  onMount(async () => {
    const formData = new FormData();
    if (searchParams.instance)
      formData.append("instance", searchParams.instance.toString());
    if (searchParams.collections)
      formData.append("collections", searchParams.collections.toString());
    if (searchParams.dids)
      formData.append("dids", searchParams.dids.toString());
    if (searchParams.cursor)
      formData.append("cursor", searchParams.cursor.toString());
    if (searchParams.allEvents)
      formData.append("allEvents", searchParams.allEvents.toString());
    if (searchParams.instance) connect(formData);
  });

  onCleanup(() => socket?.close());

  return (
    <div class="mt-4 flex flex-col items-center gap-y-3">
      <h1 class="text-lg font-bold">Jetstream Viewer</h1>
      <form method="post" action={connectSocket} class="flex flex-col gap-y-3">
        <Show when={!connected()}>
          <label class="flex items-center justify-end gap-x-2">
            <span class="">Instance</span>
            <input
              type="text"
              name="instance"
              spellcheck={false}
              value={
                searchParams.instance ??
                "wss://jetstream1.us-east.bsky.network/subscribe"
              }
              class="w-16rem dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </label>
          <label class="flex items-center justify-end gap-x-2">
            <span class="">Collections</span>
            <textarea
              name="collections"
              spellcheck={false}
              placeholder="Comma-separated list of collections"
              value={searchParams.collections ?? ""}
              class="w-16rem dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </label>
          <label class="flex items-center justify-end gap-x-2">
            <span class="">DIDs</span>
            <textarea
              name="dids"
              spellcheck={false}
              placeholder="Comma-separated list of DIDs"
              value={searchParams.dids ?? ""}
              class="w-16rem dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </label>
          <label class="flex items-center justify-end gap-x-2">
            <span class="">Cursor</span>
            <input
              type="text"
              name="cursor"
              spellcheck={false}
              placeholder="Leave empty for live-tail"
              value={searchParams.cursor ?? ""}
              class="w-16rem dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
          </label>
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
            type="submit"
            class="dark:bg-dark-700 dark:hover:bg-dark-800 w-fit rounded-lg border border-slate-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-700 dark:focus:ring-slate-300"
          >
            {connected() ? "Disconnect" : "Connect"}
          </button>
        </div>
      </form>
      <div class="break-anywhere md:w-screen-md flex w-full flex-col gap-2 divide-y divide-neutral-500 whitespace-pre-wrap font-mono text-sm">
        <For each={records().toReversed()}>
          {(rec) => (
            <div class="pt-2">
              <JSONValue data={rec} repo={rec.did} />
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export { JetstreamView };
