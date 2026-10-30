import { ComAtprotoLabelDefs } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { A, useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import type { HoverTriggerRenderer } from "../components/hover-card/base.jsx";
import DidHoverCard from "../components/hover-card/did.jsx";
import RecordHoverCard from "../components/hover-card/record.jsx";
import { FilterInput } from "../components/ui/filter-input.jsx";
import { Spinner } from "../components/ui/states.jsx";
import { TagInput } from "../components/ui/tag-input.jsx";
import Tooltip from "../components/ui/tooltip.jsx";
import { localDateFromTimestamp, relativeTimeFromTimestamp } from "../lib/format.js";
import { LoadMoreSentinel } from "../lib/infinite-scroll.jsx";
import { useFilterShortcut } from "../lib/keyboard.js";

/** The most queryLabels allows in one page. */
const LABELS_PER_PAGE = 250;

const getSearchParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * A label value's badge. A negated label is faded and struck through, not red: it means the
 * label no longer applies, and red would read as a warning.
 */
const badgeClass = (negated: boolean | undefined) =>
  `shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
    negated
      ? "bg-neutral-500/5 text-neutral-500 line-through dark:bg-neutral-400/5 dark:text-neutral-400"
      : "bg-neutral-500/10 text-neutral-700 dark:bg-neutral-400/10 dark:text-neutral-300"
  }`;

const LabelRow = (props: { label: ComAtprotoLabelDefs.Label }) => {
  const label = props.label;
  const created = new Date(label.cts).getTime();
  const expires = label.exp ? new Date(label.exp).getTime() : undefined;
  const isRecord = label.uri.startsWith("at://");

  // The whole row links to the labelled record or account, and previews it on hover.
  const row: HoverTriggerRenderer = ({ loading }) => (
    <A
      href={isRecord ? `/${label.uri}` : `/at://${label.uri}`}
      class="dark:hover:bg-dark-200 dark:active:bg-dark-100 flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-neutral-200/50 active:bg-neutral-200"
      classList={{ "hover-card-trigger-loading": loading() }}
    >
      {/* One line on wide screens; on phones the subject drops under the badge and time. */}
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span class={badgeClass(label.neg)} title={label.neg ? "Negated" : undefined}>
          {label.val}
        </span>
        <span class="order-last min-w-0 basis-full truncate text-blue-500 sm:order-none sm:flex-1 sm:basis-0 dark:text-blue-400">
          {label.uri}
        </span>
        <span class="ml-auto flex shrink-0 items-baseline gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <Tooltip text={localDateFromTimestamp(created)}>
            <span>{relativeTimeFromTimestamp(created)}</span>
          </Tooltip>
          <Show when={expires}>
            {(expiry) => (
              <Tooltip text={`Expires ${localDateFromTimestamp(expiry())}`}>
                <span class="flex items-baseline gap-1">
                  <span class="iconify lucide--clock-fading shrink-0 self-center" />
                  {relativeTimeFromTimestamp(expiry())}
                </span>
              </Tooltip>
            )}
          </Show>
        </span>
      </div>

      <Show when={label.cid}>
        {(cid) => (
          <span class="truncate font-mono text-xs text-neutral-500 dark:text-neutral-400">
            {cid()}
          </span>
        )}
      </Show>
    </A>
  );

  return (
    <Show
      when={isRecord}
      fallback={<DidHoverCard did={label.uri} class="block min-w-0" renderTrigger={row} />}
    >
      <RecordHoverCard uri={label.uri} class="block min-w-0" renderTrigger={row} />
    </Show>
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

      // The labeler's message says what went wrong; the error is only a code like InvalidRequest.
      if (!res.ok) throw new Error(res.data.message || res.data.error || "Failed to fetch labels");

      const nextLabels = res.data.labels || [];
      // A short page is the last one: some labelers send a cursor even then.
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
        {/* The placeholder says what to enter; the label stays for screen readers. */}
        <label class="flex w-full flex-col">
          <span class="sr-only">Look up labels for</span>
          <TagInput
            name="uriPatterns"
            placeholder="DID or at:// URI to look up, * for prefixes"
            initialValues={
              getSearchParam(searchParams.uriPatterns)
                ?.split(",")
                .filter((value) => value.trim()) ?? []
            }
            onChange={applyUriPatterns}
          />
        </label>
        {/* Lined up with the lookup field above: the count takes the Add button's width, and the
            box reaches 1px past each side like the lookup's outline. */}
        <div class="flex min-h-7.5 items-center gap-1.5">
          <Show when={labels().length > 1}>
            <FilterInput
              class="-mx-px min-w-0 flex-1"
              inputClass="min-w-0 grow py-1 select-none placeholder:text-sm focus:outline-none"
              inputRef={(input) => (filterInputRef = input)}
              placeholder="Filter label values… (* partial, -exclude)"
              value={filter()}
              onInput={setFilter}
            />
          </Show>
          <Show when={labels().length > 0}>
            <span class="ml-auto flex min-w-15 shrink-0 items-center justify-end gap-1 text-sm">
              <Show when={filter()}>
                <span>{filteredLabels().length}/</span>
              </Show>
              {/* "+" while the list can still load more as you scroll. */}
              <span>
                {labels().length}
                {cursor() ? "+" : ""}
              </span>
              <span class="iconify lucide--tag shrink-0" aria-hidden="true" />
              <span class="sr-only">labels</span>
            </span>
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
          <Spinner />
          Loading labels…
        </div>
      </Show>

      <Show when={(!loading() && !error()) || labels().length > 0}>
        <Show
          when={filteredLabels().length > 0}
          fallback={
            <div class="py-8 text-sm text-neutral-500 dark:text-neutral-400">
              {labels().length > 0 ? "No labels match this value filter." : "No labels found."}
            </div>
          }
        >
          {/* Pulled out by the rows' padding, so their text lines up with the inputs above. */}
          <div class="-mx-2 flex flex-col self-stretch">
            <For each={filteredLabels()}>{(label) => <LabelRow label={label} />}</For>
          </div>
        </Show>
        <LoadMoreSentinel
          hasMore={() => !!cursor() && !error()}
          loading={() => loading()}
          onLoadMore={() => void fetchLabels(uriPatterns(), false)}
        />
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
