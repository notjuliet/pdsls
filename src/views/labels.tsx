import { ComAtprotoLabelDefs } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { isAtprotoDid } from "@atcute/identity";
import { Handle } from "@atcute/lexicons";
import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { Button } from "../components/button.jsx";
import DidHoverCard from "../components/hover-card/did.jsx";
import RecordHoverCard from "../components/hover-card/record.jsx";
import { TextInput } from "../components/text-input.jsx";
import { canHover } from "../layout.jsx";
import { labelerCache, resolveHandle, resolvePDS } from "../utils/api.js";
import { localDateFromTimestamp } from "../utils/date.js";
import { useFilterShortcut } from "../utils/keyboard.js";

const LABELS_PER_PAGE = 50;
const DEFAULT_LABELER_DID = "did:plc:ar7c4by46qjdydhdevvrndac";

const LabelCard = (props: { label: ComAtprotoLabelDefs.Label }) => {
  const label = props.label;

  return (
    <div class="flex min-w-0 flex-col gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
      <div class="flex flex-wrap items-baseline gap-2 text-sm">
        <span class="iconify lucide--tag shrink-0 self-center" />
        <span class="font-medium">{label.val}</span>
        <Show when={label.neg}>
          <span class="text-xs font-medium text-red-500 dark:text-red-400">negated</span>
        </Show>
        <div class="flex flex-wrap gap-2 text-xs text-neutral-600 dark:text-neutral-400">
          <span>{localDateFromTimestamp(new Date(label.cts).getTime())}</span>
          <Show when={label.exp}>
            {(exp) => (
              <div class="flex items-center gap-x-1">
                <span class="iconify lucide--clock-fading shrink-0" />
                <span>{localDateFromTimestamp(new Date(exp()).getTime())}</span>
              </div>
            )}
          </Show>
        </div>
      </div>

      <Show
        when={label.uri.startsWith("at://")}
        fallback={<DidHoverCard did={label.uri} labelClass="block text-sm truncate" />}
      >
        <RecordHoverCard uri={label.uri} labelClass="block text-sm truncate" />
      </Show>

      <Show when={label.cid}>
        <div class="truncate font-mono text-xs text-neutral-700 dark:text-neutral-300">
          {label.cid}
        </div>
      </Show>
    </div>
  );
};

export const LabelView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [cursor, setCursor] = createSignal<string>();
  const [labels, setLabels] = createSignal<ComAtprotoLabelDefs.Label[]>([]);
  const [filter, setFilter] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [didInput, setDidInput] = createSignal(searchParams.did ?? "");

  let rpc: Client | undefined;
  let formRef!: HTMLFormElement;
  let filterInputRef: HTMLInputElement | undefined;

  const filteredLabels = createMemo(() => {
    const filterValue = filter().trim();
    if (!filterValue) return labels();

    const filters = filterValue
      .split(/[\s,]+/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const toMatcher = (pattern: string): ((value: string) => boolean) => {
      if (pattern.includes("*")) {
        const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
        const regex = new RegExp(`^${regexPattern}$`);
        return (value) => regex.test(value);
      }
      return (value) => value === pattern;
    };

    const exclusions: ((value: string) => boolean)[] = [];
    const inclusions: ((value: string) => boolean)[] = [];

    filters.forEach((f) => {
      if (f.startsWith("-")) {
        exclusions.push(toMatcher(f.slice(1).toLowerCase()));
      } else {
        inclusions.push(toMatcher(f.toLowerCase()));
      }
    });

    return labels().filter((label) => {
      const labelValue = label.val.toLowerCase();

      if (exclusions.some((exc) => exc(labelValue))) {
        return false;
      }

      if (inclusions.length > 0) {
        return inclusions.some((inc) => inc(labelValue));
      }

      // If only exclusions were specified, include everything not excluded
      return true;
    });
  });

  const hasSearched = createMemo(() => Boolean(searchParams.uriPatterns));

  onMount(async () => {
    useFilterShortcut(() => filterInputRef);

    if (searchParams.did && searchParams.uriPatterns) {
      const formData = new FormData();
      formData.append("did", searchParams.did.toString());
      formData.append("uriPatterns", searchParams.uriPatterns.toString());
      await fetchLabels(formData);
    }
  });

  const fetchLabels = async (formData: FormData, reset?: boolean) => {
    let did = formData.get("did")?.toString()?.trim() || DEFAULT_LABELER_DID;
    const uriPatterns = formData.get("uriPatterns")?.toString()?.trim();

    if (!uriPatterns) {
      setError("Please provide both DID and URI patterns");
      return;
    }

    if (reset) {
      setLabels([]);
      setCursor(undefined);
      setError(undefined);
    }

    try {
      setLoading(true);
      setError(undefined);

      if (!isAtprotoDid(did)) did = await resolveHandle(did as Handle);
      await resolvePDS(did);
      if (!labelerCache[did]) throw new Error("Repository is not a labeler");
      rpc = new Client({
        handler: simpleFetchHandler({ service: labelerCache[did] }),
      });

      setSearchParams({ did, uriPatterns });
      setDidInput(did);

      const res = await rpc.get("com.atproto.label.queryLabels", {
        params: {
          uriPatterns: uriPatterns.split(",").map((p) => p.trim()),
          sources: [did as `did:${string}:${string}`],
          cursor: cursor(),
          limit: LABELS_PER_PAGE,
        },
      });

      if (!res.ok) throw new Error(res.data.error || "Failed to fetch labels");

      const newLabels = res.data.labels || [];
      setCursor(newLabels.length < LABELS_PER_PAGE ? undefined : res.data.cursor);
      setLabels(reset ? newLabels : [...labels(), ...newLabels]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Failed to fetch labels:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchLabels(new FormData(formRef), true);
  };

  const handleLoadMore = () => {
    fetchLabels(new FormData(formRef));
  };

  return (
    <>
      <Title>Labels - PDSls</Title>
      <div class="flex w-full flex-col items-center">
        <div class="flex w-full flex-col gap-y-1 px-3 pb-3">
          <h1 class="text-lg font-semibold">Labels</h1>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            Query labels applied to accounts and records.
          </p>
        </div>
        <form
          ref={formRef}
          class="flex w-full max-w-3xl flex-col gap-y-3 px-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
        >
          <div class="flex flex-col gap-y-3">
            <label class="flex w-full flex-col gap-y-1">
              <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Labeler handle or DID
              </span>
              <TextInput
                name="did"
                value={didInput()}
                onInput={(e) => setDidInput(e.currentTarget.value)}
                placeholder="moderation.bsky.app (default)"
                class="w-full"
              />
            </label>

            <label class="flex w-full flex-col gap-y-1">
              <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                URI patterns (comma-separated)
              </span>
              <textarea
                id="uriPatterns"
                name="uriPatterns"
                spellcheck={false}
                rows={2}
                value={searchParams.uriPatterns ?? "*"}
                placeholder="at://did:web:example.com/app.bsky.feed.post/*"
                class="dark:bg-dark-100 grow rounded-lg bg-white px-2 py-1.5 text-sm outline-1 outline-neutral-200 focus:outline-neutral-400 dark:outline-neutral-600 dark:focus:outline-neutral-400"
              />
            </label>
          </div>

          <Button type="submit" disabled={loading()} classList={{ "w-fit": true }}>
            <span class="iconify lucide--search" />
            <span>Search labels</span>
          </Button>

          <Show when={error()}>
            <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error()}
            </div>
          </Show>
        </form>

        <Show when={hasSearched()}>
          <div class="w-full max-w-3xl py-2 pb-20">
            <Show when={loading() && labels().length === 0}>
              <div class="flex flex-col items-center justify-center py-12 text-center">
                <span class="iconify lucide--loader-circle mb-3 animate-spin text-4xl text-neutral-400" />
                <p class="text-sm text-neutral-600 dark:text-neutral-400">Loading labels...</p>
              </div>
            </Show>

            <Show when={!loading() || labels().length > 0}>
              <Show when={filteredLabels().length > 0}>
                <div class="grid gap-2">
                  <For each={filteredLabels()}>{(label) => <LabelCard label={label} />}</For>
                </div>
              </Show>

              <Show when={labels().length > 0 && filteredLabels().length === 0}>
                <div class="flex flex-col items-center justify-center py-8 text-center">
                  <span class="iconify lucide--search-x mb-2 text-3xl text-neutral-400" />
                  <p class="text-sm text-neutral-600 dark:text-neutral-400">
                    No labels match your filter
                  </p>
                </div>
              </Show>

              <Show when={labels().length === 0 && !loading()}>
                <div class="flex flex-col items-center justify-center py-8 text-center">
                  <span class="iconify lucide--tags mb-2 text-3xl text-neutral-400" />
                  <p class="text-sm text-neutral-600 dark:text-neutral-400">No labels found</p>
                </div>
              </Show>
            </Show>
          </div>

          <Show when={labels().length > 1}>
            <div class="dark:bg-dark-500 fixed bottom-0 z-10 flex w-full flex-col items-center gap-2 border-t border-neutral-200 bg-neutral-100 px-3 pt-3 pb-6 dark:border-neutral-700">
              <div
                class="dark:bg-dark-200 flex w-full max-w-lg cursor-text items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 dark:border-neutral-700"
                onClick={(e) => {
                  const input = e.currentTarget.querySelector("input");
                  if (e.target !== input) input?.focus();
                }}
              >
                <span class="iconify lucide--filter text-neutral-500 dark:text-neutral-400" />
                <input
                  ref={filterInputRef}
                  type="text"
                  spellcheck={false}
                  autocapitalize="off"
                  autocomplete="off"
                  class="grow py-2 select-none placeholder:text-sm focus:outline-none"
                  placeholder="Filter labels... (* for partial, -exclude)"
                  value={filter()}
                  onInput={(e) => setFilter(e.currentTarget.value)}
                />
                <Show when={canHover && !filter()}>
                  <kbd class="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-xs text-neutral-400 select-none dark:border-neutral-600 dark:bg-neutral-700">
                    /
                  </kbd>
                </Show>
              </div>

              <div class="flex min-h-7.5 w-full max-w-lg items-center justify-between">
                <div class="w-20" />

                <div>
                  <Show when={filter()}>
                    <span>{filteredLabels().length}</span>
                    <span>/</span>
                  </Show>
                  <span>{labels().length} labels</span>
                </div>

                <div class="flex w-20 items-center justify-end">
                  <Show when={cursor()}>
                    <Button
                      onClick={handleLoadMore}
                      disabled={loading()}
                      classList={{ "w-20 h-7.5 justify-center": true }}
                    >
                      <Show
                        when={!loading()}
                        fallback={
                          <span class="iconify lucide--loader-circle animate-spin text-base" />
                        }
                      >
                        Load more
                      </Show>
                    </Button>
                  </Show>
                </div>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </>
  );
};
