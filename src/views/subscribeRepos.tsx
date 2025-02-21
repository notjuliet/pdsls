import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { JSONValue } from "../components/json";
import { action, useAction, useSearchParams } from "@solidjs/router";
import { Firehose } from "../lib/firehose";

const LIMIT = 25;
type Parameter = { name: string; param: string | string[] | undefined };

const SubscribeReposView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [parameters, setParameters] = createSignal<Parameter[]>([]);
  const [records, setRecords] = createSignal<Array<any>>([]);
  const [connected, setConnected] = createSignal(false);
  let firehose: Firehose;

  const connectSocket = action(async (formData: FormData) => {
    if (connected()) {
      firehose?.close();
      setConnected(false);
      return;
    }
    setRecords([]);

    const url = formData.get("instance")?.toString() ?? "wss://bsky.network";
    const cursor = formData.get("cursor")?.toString();

    setSearchParams({
      instance: formData.get("instance")?.toString(),
      cursor: formData.get("cursor")?.toString(),
    });

    setParameters([
      { name: "Instance", param: formData.get("instance")?.toString() },
      { name: "Cursor", param: formData.get("cursor")?.toString() },
    ]);

    setConnected(true);
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
          tooBig: commit.tooBig,
          op: op,
        };
        setRecords(records().concat(record).slice(-LIMIT));
      }
    });
    firehose.on("identity", (identity) => {
      setRecords(records().concat(identity).slice(-LIMIT));
    });
    firehose.start();
  });

  const connect = useAction(connectSocket);

  onMount(async () => {
    const formData = new FormData();
    if (searchParams.instance)
      formData.append("instance", searchParams.instance.toString());
    if (searchParams.cursor)
      formData.append("cursor", searchParams.cursor.toString());
    if (searchParams.instance) connect(formData);
  });

  onCleanup(() => firehose?.close());

  return (
    <div class="mt-4 flex flex-col items-center gap-y-3">
      <h1 class="text-lg font-bold">com.atproto.sync.subscribeRepos</h1>
      <form method="post" action={connectSocket} class="flex flex-col gap-y-3">
        <Show when={!connected()}>
          <label class="flex items-center justify-end gap-x-2">
            <span class="">Instance</span>
            <input
              type="text"
              name="instance"
              spellcheck={false}
              value={searchParams.instance ?? "wss://bsky.network"}
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
              <JSONValue data={rec} repo={rec.did ?? rec.repo} />
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export { SubscribeReposView };
