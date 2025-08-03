import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { Client, CredentialManager } from "@atcute/client";
import { A, useParams, useSearchParams } from "@solidjs/router";
import { labelerCache, resolvePDS } from "../utils/api.js";
import { localDateFromTimestamp } from "../utils/date.js";
import { ComAtprotoLabelDefs } from "@atcute/atproto";
import { TextInput } from "../components/text-input.jsx";

const LabelView = () => {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cursor, setCursor] = createSignal<string>();
  const [labels, setLabels] = createSignal<ComAtprotoLabelDefs.Label[]>([]);
  const [filter, setFilter] = createSignal<string>();
  const [labelCount, setLabelCount] = createSignal(0);
  const did = params.repo;
  let rpc: Client;

  onMount(async () => {
    await resolvePDS(did);
    rpc = new Client({
      handler: new CredentialManager({ service: labelerCache[did] }),
    });
    refetch();
  });

  const fetchLabels = async () => {
    const uriPatterns = (document.getElementById("patterns") as HTMLInputElement).value;
    if (!uriPatterns) return;
    const res = await rpc.get("com.atproto.label.queryLabels", {
      params: {
        uriPatterns: uriPatterns.toString().trim().split(","),
        sources: [did as `did:${string}:${string}`],
        cursor: cursor(),
      },
    });
    if (!res.ok) throw new Error(res.data.error);
    setCursor(res.data.labels.length < 50 ? undefined : res.data.cursor);
    setLabels(labels().concat(res.data.labels) ?? res.data.labels);
    return res.data.labels;
  };

  const [response, { refetch }] = createResource(fetchLabels);

  const initQuery = async () => {
    setLabels([]);
    setCursor("");
    setSearchParams({
      uriPatterns: (document.getElementById("patterns") as HTMLInputElement).value,
    });
    refetch();
  };

  const filterLabels = () => {
    const newFilter = labels().filter((label) => (filter() ? filter() === label.val : true));
    setLabelCount(newFilter.length);
    return newFilter;
  };

  return (
    <>
      <form class="mt-3 flex flex-col items-center gap-y-1" onsubmit={(e) => e.preventDefault()}>
        <div class="w-full">
          <label for="patterns" class="ml-0.5 text-sm">
            URI Patterns (comma-separated)
          </label>
        </div>
        <div class="w-21rem sm:w-24rem flex items-center gap-x-2">
          <textarea
            id="patterns"
            name="patterns"
            spellcheck={false}
            rows={3}
            value={searchParams.uriPatterns ?? "*"}
            class="dark:bg-dark-100 focus:outline-1.5 dark:shadow-dark-900 mb-1 grow rounded-lg bg-white px-2 py-1 shadow-sm focus:outline-slate-900 dark:focus:outline-slate-100"
          />
          <div class="flex justify-center">
            <Show when={!response.loading}>
              <button onclick={() => initQuery()} type="submit">
                <div class="i-lucide-search text-xl" />
              </button>
            </Show>
            <Show when={response.loading}>
              <div class="i-lucide-loader-circle animate-spin text-xl" />
            </Show>
          </div>
        </div>
      </form>
      <div class="z-5 dark:bg-dark-500/70 backdrop-blur-xs sticky top-0 flex w-screen flex-col items-center justify-center gap-3 bg-zinc-100/70 py-3">
        <TextInput
          placeholder="Filter by label"
          onInput={(e) => setFilter(e.currentTarget.value)}
          class="w-21rem sm:w-24rem"
        />
        <div class="flex items-center gap-x-2">
          <Show when={labelCount() && labels().length}>
            <div>
              <span>
                {labelCount()} label{labelCount() > 1 ? "s" : ""}
              </span>
            </div>
          </Show>
          <Show when={cursor()}>
            <div class="flex h-[2rem] w-[5.5rem] items-center justify-center text-nowrap">
              <Show when={!response.loading}>
                <button
                  type="button"
                  onclick={() => refetch()}
                  class="dark:hover:bg-dark-100 dark:bg-dark-300 dark:shadow-dark-900 rounded-lg bg-white px-2 py-1.5 text-xs font-bold shadow-sm hover:bg-zinc-200/50"
                >
                  Load More
                </button>
              </Show>
              <Show when={response.loading}>
                <div class="i-lucide-loader-circle animate-spin text-xl" />
              </Show>
            </div>
          </Show>
        </div>
      </div>
      <Show when={labels().length}>
        <div class="break-anywhere divide-y-0.5 flex flex-col gap-2 divide-neutral-400 whitespace-pre-wrap text-sm dark:divide-neutral-600">
          <For each={filterLabels()}>
            {(label) => (
              <div class="flex items-center justify-between gap-2 pb-2">
                <div class="flex flex-col">
                  <div class="flex items-center gap-x-2">
                    <div class="min-w-[5rem] font-semibold text-stone-600 dark:text-stone-400">
                      URI
                    </div>
                    <A
                      href={`/at://${label.uri.replace("at://", "")}`}
                      target="_blank"
                      class="text-blue-400 hover:underline"
                    >
                      {label.uri}
                    </A>
                  </div>
                  <Show when={label.cid}>
                    <div class="flex items-center gap-x-2">
                      <div class="min-w-[5rem] font-semibold text-stone-600 dark:text-stone-400">
                        CID
                      </div>
                      {label.cid}
                    </div>
                  </Show>
                  <div class="flex items-center gap-x-2">
                    <div class="min-w-[5rem] font-semibold text-stone-600 dark:text-stone-400">
                      Label
                    </div>
                    {label.val}
                  </div>
                  <div class="flex items-center gap-x-2">
                    <div class="min-w-[5rem] font-semibold text-stone-600 dark:text-stone-400">
                      Created
                    </div>
                    {localDateFromTimestamp(new Date(label.cts).getTime())}
                  </div>
                  <Show when={label.exp}>
                    {(exp) => (
                      <div class="flex items-center gap-x-2">
                        <div class="min-w-[5rem] font-semibold text-stone-600 dark:text-stone-400">
                          Expires
                        </div>
                        {localDateFromTimestamp(new Date(exp()).getTime())}
                      </div>
                    )}
                  </Show>
                </div>
                <Show when={label.neg}>
                  <div class="i-lucide-minus shrink-0 text-xl text-red-500 dark:text-red-400" />
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={!labels().length && !response.loading && searchParams.uriPatterns}>
        <div class="mt-2">No results</div>
      </Show>
    </>
  );
};

export { LabelView };
