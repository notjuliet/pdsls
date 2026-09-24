import { ComAtprotoLabelDefs } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { Button } from "../components/button.jsx";
import { FilterInput } from "../components/filter-input.jsx";
import DidHoverCard from "../components/hover-card/did.jsx";
import RecordHoverCard from "../components/hover-card/record.jsx";
import { TagInput } from "../components/tag-input.jsx";
import { useFilterShortcut } from "../lib/keyboard.js";
import { localDateFromTimestamp } from "../utils/format.js";

const LABELS_PER_PAGE = 50;

const getSearchParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const LabelRow = (props: { label: ComAtprotoLabelDefs.Label }) => {
  const label = props.label;

  return (
    <div class="flex min-w-0 flex-col gap-1 px-2 py-2">
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span class="truncate font-medium">{label.val}</span>
        <Show when={label.neg}>
          <span class="shrink-0 font-medium text-red-500 dark:text-red-400">negated</span>
        </Show>
        <div class="ml-auto flex flex-wrap justify-end gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span>{localDateFromTimestamp(new Date(label.cts).getTime())}</span>
          <Show when={label.exp}>
            {(expiration) => (
              <span class="flex items-center gap-1">
                <span class="iconify lucide--clock-fading shrink-0" />
                {localDateFromTimestamp(new Date(expiration()).getTime())}
              </span>
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
        {(cid) => (
          <span class="truncate font-mono text-xs text-neutral-500 dark:text-neutral-400">
            {cid()}
          </span>
        )}
      </Show>
    </div>
  );
};

export const LabelFeed = (props: { labelerDid: string; labelerEndpoint: string }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [cursor, setCursor] = createSignal<string>();
  const [labels, setLabels] = createSignal<ComAtprotoLabelDefs.Label[]>([]);
  const [filter, setFilter] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string>();
  const [isSticky, setIsSticky] = createSignal(false);
  const [uriPatterns, setUriPatterns] = createSignal(
    getSearchParam(searchParams.uriPatterns) || "*",
  );
  const rpc = new Client({
    handler: simpleFetchHandler({ service: props.labelerEndpoint }),
  });

  let filterInputRef: HTMLInputElement | undefined;
  let stickySentinelRef!: HTMLDivElement;

  const filteredLabels = createMemo(() => {
    const filterValue = filter().trim();
    if (!filterValue) return labels();

    const filters = filterValue
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);

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

    for (const value of filters) {
      if (value.startsWith("-")) exclusions.push(toMatcher(value.slice(1).toLowerCase()));
      else inclusions.push(toMatcher(value.toLowerCase()));
    }

    return labels().filter((label) => {
      const value = label.val.toLowerCase();
      if (exclusions.some((exclude) => exclude(value))) return false;
      return inclusions.length === 0 || inclusions.some((include) => include(value));
    });
  });

  const fetchLabels = async (uriPatterns: string, reset = false) => {
    if (reset) {
      setLabels([]);
      setCursor(undefined);
    }

    setLoading(true);
    setError(undefined);

    try {
      const query = uriPatterns === "*" ? "" : `?uriPatterns=${encodeURIComponent(uriPatterns)}`;
      if (location.search !== query) {
        navigate(`${location.pathname}${query}${location.hash}`, { replace: true });
      }
      const res = await rpc.get("com.atproto.label.queryLabels", {
        params: {
          uriPatterns: uriPatterns.split(",").map((pattern) => pattern.trim()),
          sources: [props.labelerDid as `did:${string}:${string}`],
          cursor: reset ? undefined : cursor(),
          limit: LABELS_PER_PAGE,
        },
      });

      if (!res.ok) throw new Error(res.data.error || "Failed to fetch labels");

      const nextLabels = res.data.labels || [];
      setCursor(nextLabels.length < LABELS_PER_PAGE ? undefined : res.data.cursor);
      setLabels(reset ? nextLabels : [...labels(), ...nextLabels]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load labels");
    } finally {
      setLoading(false);
    }
  };

  const applyUriPatterns = (values: string[]) => {
    const next = values.join(",") || "*";
    setUriPatterns(next);
    void fetchLabels(next, true);
  };

  onMount(() => {
    useFilterShortcut(() => filterInputRef);
    const stickyObserver = new IntersectionObserver(([entry]) => {
      setIsSticky(!entry.isIntersecting);
    });
    stickyObserver.observe(stickySentinelRef);
    onCleanup(() => stickyObserver.disconnect());

    void fetchLabels(uriPatterns(), true);
  });

  return (
    <div class="flex w-full flex-col items-center">
      <div ref={stickySentinelRef} class="-mb-px h-px w-full" aria-hidden="true" />
      <div
        class="dark:bg-dark-500 sticky top-0 z-10 flex w-full flex-col gap-2 bg-neutral-100 pb-3"
        classList={{ "top-controls-fade": isSticky() }}
      >
        <label class="flex w-full flex-col gap-1">
          <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Target URI</span>
          <TagInput
            name="uriPatterns"
            placeholder="at://did:web:example.com/app.bsky.feed.post/*"
            initialValues={
              getSearchParam(searchParams.uriPatterns)
                ?.split(",")
                .filter((value) => value.trim()) ?? []
            }
            onChange={applyUriPatterns}
          />
        </label>
        <div class="flex min-h-7.5 items-center gap-2">
          <Show when={labels().length > 1}>
            <FilterInput
              class="min-w-0 flex-1"
              inputRef={(input) => (filterInputRef = input)}
              placeholder="Filter label values… (* partial, -exclude)"
              value={filter()}
              onInput={setFilter}
            />
          </Show>
          <Show when={labels().length > 0}>
            <span class="ml-auto flex shrink-0 items-center gap-1 text-sm">
              <Show when={filter()}>
                <span>{filteredLabels().length}/</span>
              </Show>
              <span>{labels().length}</span>
              <span class="iconify lucide--tag shrink-0" aria-hidden="true" />
              <span class="sr-only">labels</span>
            </span>
          </Show>
          <Show when={cursor()}>
            <Button
              onClick={() => void fetchLabels(uriPatterns(), false)}
              disabled={loading()}
              classList={{ "h-7.5 w-20 shrink-0 justify-center": true }}
            >
              <Show
                when={!loading()}
                fallback={<span class="iconify lucide--loader-circle animate-spin" />}
              >
                Load more
              </Show>
            </Button>
          </Show>
        </div>
      </div>

      <Show when={error()}>
        {(message) => (
          <div class="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {message()}
          </div>
        )}
      </Show>

      <Show when={loading() && labels().length === 0}>
        <div class="flex items-center gap-2 py-8 text-sm text-neutral-500 dark:text-neutral-400">
          <span class="iconify lucide--loader-circle animate-spin" />
          Loading labels…
        </div>
      </Show>

      <Show when={!loading() || labels().length > 0}>
        <Show
          when={filteredLabels().length > 0}
          fallback={
            <div class="py-8 text-sm text-neutral-500 dark:text-neutral-400">
              {labels().length > 0 ? "No labels match this value filter." : "No labels found."}
            </div>
          }
        >
          <div class="w-full divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800">
            <For each={filteredLabels()}>{(label) => <LabelRow label={label} />}</For>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export const LegacyLabelsRedirect = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  createEffect(() => {
    const did = getSearchParam(searchParams.did);
    const uriPatterns = getSearchParam(searchParams.uriPatterns);
    const query =
      uriPatterns && uriPatterns !== "*" ? `?uriPatterns=${encodeURIComponent(uriPatterns)}` : "";
    navigate(did ? `/at://${did}${query}#labels` : "/", { replace: true });
  });

  return null;
};
