import { createSignal, For, onCleanup, Show, type Component } from "solid-js";
import { JSONValue } from "../components/json";
import { action } from "@solidjs/router";

const FirehoseView: Component = () => {
  const [records, setRecords] = createSignal<Array<any>>([]);
  const [showAllEvents, setShowAllEvents] = createSignal(false);
  let socket: WebSocket;

  const connect = action(async (formData: FormData) => {
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
    console.log(url);
    const socket = new WebSocket(url);
    socket.addEventListener("message", (event) => {
      const rec = JSON.parse(event.data);
      if (
        showAllEvents() ||
        (rec.kind !== "account" && rec.kind !== "identity")
      )
        setRecords(records().concat(rec).slice(-5));
    });
  });

  onCleanup(() => socket?.close());

  return (
    <div class="mt-5 flex flex-col items-center gap-y-4">
      <form method="post" action={connect} class="flex flex-col gap-y-3">
        <label class="flex items-center gap-x-2 text-right">
          <span class="basis-1/2">Instance</span>
          <input
            type="text"
            name="instance"
            spellcheck={false}
            size={25}
            value="wss://jetstream1.us-east.bsky.network/subscribe"
            class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </label>
        <label class="flex items-center gap-x-2 text-right">
          <span class="basis-1/2">Collections</span>
          <input
            type="text"
            name="collections"
            spellcheck={false}
            size={25}
            placeholder="Comma-separated list of collections"
            class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </label>
        <label class="flex items-center gap-x-2 text-right">
          <span class="basis-1/2">DIDs</span>
          <input
            type="text"
            name="dids"
            spellcheck={false}
            size={25}
            placeholder="Comma-separated list of DIDs"
            class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </label>
        <label class="flex items-center gap-x-2 text-right">
          <span class="basis-1/2">Cursor</span>
          <input
            type="text"
            name="cursor"
            spellcheck={false}
            size={25}
            placeholder="Leave empty for live-tail"
            class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </label>
        <div class="flex items-center justify-end gap-x-1">
          <input
            type="checkbox"
            id="allEvents"
            onChange={(e) => setShowAllEvents(e.currentTarget.checked)}
          />
          <label for="allEvents" class="select-none">
            Show account and identity events
          </label>
        </div>
        <div class="flex justify-end">
          <button
            type="submit"
            class="dark:bg-dark-700 dark:hover:bg-dark-800 w-fit rounded-lg border border-slate-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-700 dark:focus:ring-slate-300"
          >
            Connect
          </button>
        </div>
      </form>
      <For each={records().reverse()}>
        {(rec) => (
          <Show
            when={
              showAllEvents() ||
              (rec.kind !== "account" && rec.kind !== "identity")
            }
          >
            <div class="break-anywhere whitespace-pre-wrap border-b border-neutral-500 pb-2 font-mono text-sm">
              <JSONValue data={rec} repo={rec.did} />
            </div>
          </Show>
        )}
      </For>
    </div>
  );
};

export { FirehoseView };
