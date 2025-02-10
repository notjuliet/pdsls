import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { CredentialManager, XRPC } from "@atcute/client";
import { A, useParams, useSearchParams } from "@solidjs/router";
import { labelerCache, resolvePDS } from "../utils/api.js";
import { ComAtprotoLabelDefs } from "@atcute/client/lexicons";
import { localDateFromTimestamp } from "../utils/date.js";

const LabelView = () => {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cursor, setCursor] = createSignal<string>();
  const [labels, setLabels] = createSignal<ComAtprotoLabelDefs.Label[]>([]);
  const [filter, setFilter] = createSignal<string>();
  const [labelCount, setLabelCount] = createSignal(0);
  const did = params.repo;
  let rpc: XRPC;

  onMount(async () => {
    await resolvePDS(did);
    rpc = new XRPC({
      handler: new CredentialManager({ service: labelerCache[did] }),
    });
    if (searchParams.uriPatterns) refetch();
  });

  const fetchLabels = async () => {
    const uriPatterns = (
      document.getElementById("patterns") as HTMLInputElement
    ).value;
    if (!uriPatterns) return;
    const res = await rpc.get("com.atproto.label.queryLabels", {
      params: {
        uriPatterns: uriPatterns.toString().trim().split(","),
        sources: [did as `did:${string}`],
        cursor: cursor(),
      },
    });
    setCursor(res.data.labels.length < 50 ? undefined : res.data.cursor);
    setLabels(labels().concat(res.data.labels) ?? res.data.labels);
    return res.data.labels;
  };

  const [response, { refetch }] = createResource(fetchLabels);

  const initQuery = async () => {
    setLabels([]);
    setCursor("");
    setSearchParams({
      uriPatterns: (document.getElementById("patterns") as HTMLInputElement)
        .value,
    });
    refetch();
  };

  const filterLabels = () => {
    const newFilter = labels().filter((label) =>
      filter() ? filter() === label.val : true,
    );
    setLabelCount(newFilter.length);
    return newFilter;
  };

  return (
    <>
      <form
        class="mt-3 flex flex-col items-center gap-y-1"
        onsubmit={(e) => e.preventDefault()}
      >
        <div class="w-full">
          <label for="patterns" class="ml-0.5 text-sm">
            URI Patterns (comma-separated)
          </label>
        </div>
        <div class="relative flex items-center gap-x-2">
          <textarea
            id="patterns"
            name="patterns"
            spellcheck={false}
            rows={3}
            cols={25}
            value={searchParams.uriPatterns ?? ""}
            class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <div class="absolute -right-14 flex min-w-[3rem] justify-center">
            <Show when={!response.loading}>
              <button
                onclick={() => initQuery()}
                type="submit"
                class="dark:bg-dark-700 dark:hover:bg-dark-800 rounded-lg border border-gray-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
              >
                Get
              </button>
            </Show>
            <Show when={response.loading}>
              <div class="i-line-md-loading-twotone-loop text-xl"></div>
            </Show>
          </div>
        </div>
      </form>
      <div class="z-5 dark:bg-dark-700 sticky top-0 flex w-full flex-col items-center justify-center gap-3 border-b border-neutral-500 bg-slate-100 py-3">
        <input
          type="text"
          spellcheck={false}
          placeholder="Filter by label"
          class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          onInput={(e) => setFilter(e.currentTarget.value)}
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
                  class="dark:bg-dark-700 dark:hover:bg-dark-800 rounded-lg border border-gray-400 bg-white px-2 py-1.5 text-sm font-bold hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  Load More
                </button>
              </Show>
              <Show when={response.loading}>
                <div class="i-line-md-loading-twotone-loop text-xl"></div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
      <Show when={labels().length}>
        <div class="break-anywhere flex flex-col gap-2 divide-y divide-neutral-400 whitespace-pre-wrap font-mono dark:divide-neutral-600">
          <For each={filterLabels()}>
            {(label) => (
              <div class="flex justify-between gap-2 pt-2">
                <div class="flex flex-col gap-x-2">
                  <div class="flex items-center gap-x-2">
                    <div class="min-w-[5rem] font-semibold text-stone-600 dark:text-stone-400">
                      URI
                    </div>
                    <A
                      href={`/at/${label.uri.replace("at://", "")}`}
                      target="_blank"
                      class="underline"
                    >
                      {label.uri}
                    </A>
                  </div>
                  <Show when={label.cid}>
                    <div class="flex gap-x-2">
                      <div class="min-w-[5rem] font-semibold text-stone-600 dark:text-stone-400">
                        CID
                      </div>
                      {label.cid}
                    </div>
                  </Show>
                  <div class="flex gap-x-2">
                    <div class="min-w-[5rem] font-semibold text-stone-600 dark:text-stone-400">
                      Label
                    </div>
                    {label.val}
                  </div>
                  <div class="flex gap-x-2">
                    <div class="min-w-[5rem] font-semibold text-stone-600 dark:text-stone-400">
                      Created
                    </div>
                    {localDateFromTimestamp(new Date(label.cts).getTime())}
                  </div>
                  <Show when={label.exp}>
                    {(exp) => (
                      <div class="flex gap-x-2">
                        <div class="min-w-[5rem] font-semibold text-stone-600 dark:text-stone-400">
                          Expires
                        </div>
                        {localDateFromTimestamp(new Date(exp()).getTime())}
                      </div>
                    )}
                  </Show>
                </div>
                <Show when={label.neg}>
                  <div class="i-lucide-minus text-lg text-xl text-red-500 dark:text-red-400" />
                </Show>
                <Show when={!label.neg}>
                  <div class="i-lucide-plus text-lg text-green-500 dark:text-green-400" />
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show
        when={!labels().length && !response.loading && searchParams.uriPatterns}
      >
        <div class="mt-2">No results</div>
      </Show>
    </>
  );
};

export { LabelView };
