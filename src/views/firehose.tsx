import { createSignal, onCleanup, Show, type Component } from "solid-js";
import { JSONValue } from "../components/json";
import { action } from "@solidjs/router";

const FirehoseView: Component = () => {
  const [records, setRecords] = createSignal<Array<any>>([]);
  const [showAllEvents, setShowAllEvents] = createSignal(false);
  let socket: WebSocket;

  const connect = action(async (formData: FormData) => {
    let url = "wss://jetstream1.us-east.bsky.network/subscribe?";
    const collection = formData.get("collection");
    if (collection) url = url.concat(`wantedCollections=${collection}`);
    const did = formData.get("did");
    if (collection && did) url = url.concat("&");
    if (did) url = url.concat(`wantedDids=${did}`);
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
      <form
        method="post"
        action={connect}
        class="flex flex-col gap-y-3 font-sans"
      >
        <div class="flex items-center gap-x-2">
          <label for="collection" class="basis-1/2">
            Collection
          </label>
          <input
            type="text"
            id="collection"
            name="collection"
            spellcheck={false}
            placeholder="app.bsky.feed.post"
            class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>
        <div class="flex items-center gap-x-2">
          <label for="did" class="basis-1/2 text-right">
            DID
          </label>
          <input
            type="text"
            id="did"
            name="did"
            spellcheck={false}
            placeholder="did:plc:oisofpd7lj26yvgiivf3lxsi"
            class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
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
      <div class="flex items-center gap-x-1">
        <input
          type="checkbox"
          id="allEvents"
          onChange={(e) => setShowAllEvents(e.currentTarget.checked)}
        />
        <label for="allEvents" class="select-none">
          Show account and identity events
        </label>
      </div>
      {records()
        .reverse()
        .map((rec) => {
          return (
            <Show
              when={
                showAllEvents() ||
                (rec.kind !== "account" && rec.kind !== "identity")
              }
            >
              <div class="w-[40rem]">
                <JSONValue data={rec} repo={rec.did} />
              </div>
            </Show>
          );
        })}
    </div>
  );
};

export { FirehoseView };
