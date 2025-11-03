import { ComAtprotoLabelDefs } from "@atcute/atproto";
import { Client, CredentialManager } from "@atcute/client";
import { A, useSearchParams } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import { Button } from "../components/button.jsx";
import { StickyOverlay } from "../components/sticky.jsx";
import { TextInput } from "../components/text-input.jsx";
import { labelerCache, resolvePDS } from "../utils/api.js";
import { localDateFromTimestamp } from "../utils/date.js";

export const LabelView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cursor, setCursor] = createSignal<string>();
  const [labels, setLabels] = createSignal<ComAtprotoLabelDefs.Label[]>([]);
  const [filter, setFilter] = createSignal<string>();
  const [labelCount, setLabelCount] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  let rpc: Client;
  let formRef!: HTMLFormElement;

  onMount(async () => {
    const formData = new FormData();
    if (searchParams.did) formData.append("did", searchParams.did.toString());
    if (searchParams.did) fetchLabels(formData);
  });

  const fetchLabels = async (formData: FormData, reset?: boolean) => {
    if (reset) {
      setLabels([]);
      setCursor(undefined);
    }

    const did = formData.get("did")?.toString();
    if (!did) return;
    await resolvePDS(did);
    rpc = new Client({
      handler: new CredentialManager({ service: labelerCache[did] }),
    });

    const uriPatterns = formData.get("uriPatterns")?.toString();
    if (!uriPatterns) return;

    setSearchParams({
      did: formData.get("did")?.toString(),
      uriPatterns: formData.get("uriPatterns")?.toString(),
    });

    setLoading(true);
    const res = await rpc.get("com.atproto.label.queryLabels", {
      params: {
        uriPatterns: uriPatterns.toString().trim().split(","),
        sources: [did as `did:${string}:${string}`],
        cursor: cursor(),
      },
    });
    setLoading(false);
    if (!res.ok) throw new Error(res.data.error);
    setCursor(res.data.labels.length < 50 ? undefined : res.data.cursor);
    setLabels(labels().concat(res.data.labels) ?? res.data.labels);
    return res.data.labels;
  };

  const filterLabels = () => {
    const newFilter = labels().filter((label) => (filter() ? filter() === label.val : true));
    setLabelCount(newFilter.length);
    return newFilter;
  };

  return (
    <div class="flex w-full flex-col items-center">
      <form ref={formRef} class="flex w-full flex-col items-center gap-y-1 px-2">
        <label class="flex w-full items-center gap-x-2 px-1">
          <span class="">DID</span>
          <TextInput name="did" value={searchParams.did ?? ""} class="grow" />
        </label>
        <label for="uriPatterns" class="ml-2 w-full text-sm">
          URI Patterns (comma-separated)
        </label>
        <div class="flex w-full items-center gap-x-1 px-1">
          <textarea
            id="uriPatterns"
            name="uriPatterns"
            spellcheck={false}
            rows={2}
            value={searchParams.uriPatterns ?? "*"}
            class="dark:bg-dark-100 dark:shadow-dark-700 grow rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 py-1 text-sm shadow-xs focus:outline-[1px] focus:outline-neutral-600 dark:border-neutral-600 dark:focus:outline-neutral-400"
          />
          <div class="flex justify-center">
            <Show when={!loading()}>
              <button
                type="button"
                onClick={() => fetchLabels(new FormData(formRef), true)}
                class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
              >
                <span class="iconify lucide--search text-lg"></span>
              </button>
            </Show>
            <Show when={loading()}>
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
          name="filter"
          onInput={(e) => setFilter(e.currentTarget.value)}
          class="w-full text-sm"
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
            <div class="flex h-8 w-22 items-center justify-center text-nowrap">
              <Show when={!loading()}>
                <Button onClick={() => fetchLabels(new FormData(formRef))}>Load More</Button>
              </Show>
              <Show when={loading()}>
                <div class="iconify lucide--loader-circle animate-spin text-xl" />
              </Show>
            </div>
          </Show>
        </div>
      </StickyOverlay>
      <Show when={labels().length}>
        <div class="flex flex-col gap-2 divide-y-[0.5px] divide-neutral-400 text-sm wrap-anywhere whitespace-pre-wrap dark:divide-neutral-600">
          <For each={filterLabels()}>
            {(label) => (
              <div class="flex items-center justify-between gap-2 pb-2">
                <div class="flex flex-col">
                  <div class="flex items-center gap-x-2">
                    <div class="min-w-16 font-semibold">URI</div>
                    <A
                      href={`/at://${label.uri.replace("at://", "")}`}
                      class="text-blue-400 hover:underline active:underline"
                    >
                      {label.uri}
                    </A>
                  </div>
                  <Show when={label.cid}>
                    <div class="flex items-center gap-x-2">
                      <div class="min-w-16 font-semibold">CID</div>
                      {label.cid}
                    </div>
                  </Show>
                  <div class="flex items-center gap-x-2">
                    <div class="min-w-16 font-semibold">Label</div>
                    {label.val}
                  </div>
                  <div class="flex items-center gap-x-2">
                    <div class="min-w-16 font-semibold">Created</div>
                    {localDateFromTimestamp(new Date(label.cts).getTime())}
                  </div>
                  <Show when={label.exp}>
                    {(exp) => (
                      <div class="flex items-center gap-x-2">
                        <div class="min-w-16 font-semibold">Expires</div>
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
      <Show when={!labels().length && !loading() && searchParams.uriPatterns}>
        <div class="mt-2">No results</div>
      </Show>
    </div>
  );
};
