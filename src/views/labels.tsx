import { ComAtprotoLabelDefs } from "@atcute/atproto";
import { Client, CredentialManager } from "@atcute/client";
import { A, useParams, useSearchParams } from "@solidjs/router";
import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { Button } from "../components/button.jsx";
import { StickyOverlay } from "../components/sticky.jsx";
import { TextInput } from "../components/text-input.jsx";
import { labelerCache, resolvePDS } from "../utils/api.js";
import { localDateFromTimestamp } from "../utils/date.js";

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
    <div class="flex w-full flex-col items-center">
      <form
        class="flex w-[22rem] flex-col items-center gap-y-1 sm:w-[24rem]"
        onsubmit={(e) => {
          e.preventDefault();
          initQuery();
        }}
      >
        <div class="w-full">
          <label for="patterns" class="ml-0.5 text-sm">
            URI Patterns (comma-separated)
          </label>
        </div>
        <div class="flex w-full items-center gap-x-1">
          <textarea
            id="patterns"
            name="patterns"
            spellcheck={false}
            rows={3}
            value={searchParams.uriPatterns ?? "*"}
            class="dark:bg-dark-100 dark:shadow-dark-800 mb-1 grow rounded-lg bg-white px-2 py-1 shadow-xs focus:outline-[1.5px] focus:outline-neutral-900 dark:focus:outline-neutral-200"
          />
          <div class="flex justify-center">
            <Show when={!response.loading}>
              <button
                type="submit"
                class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
              >
                <span class="iconify lucide--search text-lg"></span>
              </button>
            </Show>
            <Show when={response.loading}>
              <div class="m-1 flex items-center">
                <span class="iconify lucide--loader-circle animate-spin text-lg"></span>
              </div>
            </Show>
          </div>
        </div>
      </form>
      <StickyOverlay>
        <TextInput
          placeholder="Filter by label"
          onInput={(e) => setFilter(e.currentTarget.value)}
          class="w-[22rem] sm:w-[24rem]"
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
                <Button onClick={() => refetch()}>Load More</Button>
              </Show>
              <Show when={response.loading}>
                <div class="iconify lucide--loader-circle animate-spin text-xl" />
              </Show>
            </div>
          </Show>
        </div>
      </StickyOverlay>
      <Show when={labels().length}>
        <div class="flex max-w-full min-w-[22rem] flex-col gap-2 divide-y-[0.5px] divide-neutral-400 text-sm wrap-anywhere whitespace-pre-wrap sm:min-w-[24rem] dark:divide-neutral-600">
          <For each={filterLabels()}>
            {(label) => (
              <div class="flex items-center justify-between gap-2 pb-2">
                <div class="flex flex-col">
                  <div class="flex items-center gap-x-2">
                    <div class="min-w-[5rem] font-semibold">URI</div>
                    <A
                      href={`/at://${label.uri.replace("at://", "")}`}
                      target="_blank"
                      class="text-blue-400 hover:underline active:underline"
                    >
                      {label.uri}
                    </A>
                  </div>
                  <Show when={label.cid}>
                    <div class="flex items-center gap-x-2">
                      <div class="min-w-[5rem] font-semibold">CID</div>
                      {label.cid}
                    </div>
                  </Show>
                  <div class="flex items-center gap-x-2">
                    <div class="min-w-[5rem] font-semibold">Label</div>
                    {label.val}
                  </div>
                  <div class="flex items-center gap-x-2">
                    <div class="min-w-[5rem] font-semibold">Created</div>
                    {localDateFromTimestamp(new Date(label.cts).getTime())}
                  </div>
                  <Show when={label.exp}>
                    {(exp) => (
                      <div class="flex items-center gap-x-2">
                        <div class="min-w-[5rem] font-semibold">Expires</div>
                        {localDateFromTimestamp(new Date(exp()).getTime())}
                      </div>
                    )}
                  </Show>
                </div>
                <Show when={label.neg}>
                  <div class="iconify lucide--minus shrink-0 text-lg text-red-500 dark:text-red-400" />
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={!labels().length && !response.loading && searchParams.uriPatterns}>
        <div class="mt-2">No results</div>
      </Show>
    </div>
  );
};

export { LabelView };
