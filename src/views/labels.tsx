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
import { StickyOverlay } from "../components/sticky.jsx";
import { TextInput } from "../components/text-input.jsx";
import { labelerCache, resolveHandle, resolvePDS } from "../utils/api.js";
import { localDateFromTimestamp } from "../utils/date.js";

const LABELS_PER_PAGE = 50;

const LabelCard = (props: { label: ComAtprotoLabelDefs.Label }) => {
  const label = props.label;

  return (
    <div class="flex flex-col gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
      <div class="flex gap-1 text-sm">
        <span class="iconify lucide--tag shrink-0 self-center" />
        <div class="flex flex-wrap items-baseline gap-2">
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
      </div>

      <Show
        when={label.uri.startsWith("at://")}
        fallback={<DidHoverCard did={label.uri} labelClass="block text-sm break-all" />}
      >
        <RecordHoverCard uri={label.uri} labelClass="block text-sm break-all" />
      </Show>

      <Show when={label.cid}>
        <div class="font-mono text-xs break-all text-neutral-700 dark:text-neutral-300">
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

  const filteredLabels = createMemo(() => {
    const filterValue = filter().trim();
    if (!filterValue) return labels();

    const filters = filterValue
      .split(/[\s,]+/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const exclusions: { pattern: string; hasWildcard: boolean }[] = [];
    const inclusions: { pattern: string; hasWildcard: boolean }[] = [];

    filters.forEach((f) => {
      if (f.startsWith("-")) {
        const lower = f.slice(1).toLowerCase();
        exclusions.push({
          pattern: lower,
          hasWildcard: lower.includes("*"),
        });
      } else {
        const lower = f.toLowerCase();
        inclusions.push({
          pattern: lower,
          hasWildcard: lower.includes("*"),
        });
      }
    });

    const matchesPattern = (value: string, filter: { pattern: string; hasWildcard: boolean }) => {
      if (filter.hasWildcard) {
        // Convert wildcard pattern to regex
        const regexPattern = filter.pattern
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special regex chars except *
          .replace(/\*/g, ".*"); // Replace * with .*
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(value);
      } else {
        return value === filter.pattern;
      }
    };

    return labels().filter((label) => {
      const labelValue = label.val.toLowerCase();

      if (exclusions.some((exc) => matchesPattern(labelValue, exc))) {
        return false;
      }

      // If there are inclusions, at least one must match
      if (inclusions.length > 0) {
        return inclusions.some((inc) => matchesPattern(labelValue, inc));
      }

      // If only exclusions were specified, include everything not excluded
      return true;
    });
  });

  const hasSearched = createMemo(() => Boolean(searchParams.uriPatterns));

  onMount(async () => {
    if (searchParams.did && searchParams.uriPatterns) {
      const formData = new FormData();
      formData.append("did", searchParams.did.toString());
      formData.append("uriPatterns", searchParams.uriPatterns.toString());
      await fetchLabels(formData);
    }
  });

  const fetchLabels = async (formData: FormData, reset?: boolean) => {
    let did = formData.get("did")?.toString()?.trim() || "did:plc:ar7c4by46qjdydhdevvrndac";
    const uriPatterns = formData.get("uriPatterns")?.toString()?.trim();

    if (!did || !uriPatterns) {
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
            Query labels applied by labelers to accounts and records.
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
                class="dark:bg-dark-100 grow rounded-lg bg-white px-2 py-1.5 text-sm outline-1 outline-neutral-200 focus:outline-[1.5px] focus:outline-neutral-600 dark:outline-neutral-600 dark:focus:outline-neutral-400"
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
          <StickyOverlay>
            <div class="flex w-full items-center gap-x-2">
              <TextInput
                placeholder="Filter labels (* for partial, -exclude)"
                name="filter"
                value={filter()}
                onInput={(e) => setFilter(e.currentTarget.value)}
                class="min-w-0 grow text-sm placeholder:text-xs"
              />
              <div class="flex shrink-0 items-center gap-x-2 text-sm">
                <Show when={labels().length > 0}>
                  <span class="whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                    {filteredLabels().length}/{labels().length}
                  </span>
                </Show>

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
          </StickyOverlay>

          <div class="w-full max-w-3xl py-2">
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
        </Show>
      </div>
    </>
  );
};
