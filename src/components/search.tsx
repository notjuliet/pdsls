import { Client, simpleFetchHandler } from "@atcute/client";
import { Nsid } from "@atcute/lexicons";
import { A, useNavigate } from "@solidjs/router";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { isTouchDevice } from "../layout";
import { resolveLexiconAuthority, resolveLexiconAuthorityDirect } from "../utils/api";
import { appHandleLink, appList, AppUrl } from "../utils/app-urls";
import { createDebouncedValue } from "../utils/hooks/debounced";
import { Button } from "./button";
import { Modal } from "./modal";

type RecentSearch = {
  path: string;
  label: string;
  type: "handle" | "did" | "at-uri" | "lexicon" | "pds" | "url";
};

const RECENT_SEARCHES_KEY = "recent-searches";
const MAX_RECENT_SEARCHES = 5;

const getRecentSearches = (): RecentSearch[] => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const addRecentSearch = (search: RecentSearch) => {
  const searches = getRecentSearches();
  const filtered = searches.filter((s) => s.path !== search.path);
  const updated = [search, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
};

const removeRecentSearch = (path: string) => {
  const searches = getRecentSearches();
  const updated = searches.filter((s) => s.path !== path);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
};

export const [showSearch, setShowSearch] = createSignal(false);

const SEARCH_PREFIXES: { prefix: string; description: string }[] = [
  { prefix: "@", description: "example.com" },
  { prefix: "did:", description: "web:example.com" },
  { prefix: "at:", description: "//example.com/com.example.test/self" },
  { prefix: "lex:", description: "com.example.test" },
  { prefix: "pds:", description: "host.example.com" },
];

const parsePrefix = (input: string): { prefix: string | null; query: string } => {
  const matchedPrefix = SEARCH_PREFIXES.find((p) => input.toLowerCase().startsWith(p.prefix));
  if (matchedPrefix) {
    return {
      prefix: matchedPrefix.prefix,
      query: input.slice(matchedPrefix.prefix.length),
    };
  }
  return { prefix: null, query: input };
};

export const SearchButton = () => {
  onMount(() => window.addEventListener("keydown", keyEvent));
  onCleanup(() => window.removeEventListener("keydown", keyEvent));

  const keyEvent = (ev: KeyboardEvent) => {
    if (document.querySelector("[data-modal]")) return;

    if ((ev.ctrlKey || ev.metaKey) && ev.key == "k") {
      ev.preventDefault();

      if (showSearch()) {
        const searchInput = document.querySelector("#input") as HTMLInputElement;
        if (searchInput && document.activeElement !== searchInput) {
          searchInput.focus();
        } else {
          setShowSearch(false);
        }
      } else {
        setShowSearch(true);
      }
    } else if (ev.key == "Escape") {
      ev.preventDefault();
      setShowSearch(false);
    }
  };

  return (
    <Button onClick={() => setShowSearch(!showSearch())}>
      <span class="iconify lucide--search"></span>
      <span>Search</span>
      <Show when={!isTouchDevice}>
        <kbd class="font-sans text-neutral-400 dark:text-neutral-500">
          {/Mac/i.test(navigator.platform) ? "⌘" : "⌃"}K
        </kbd>
      </Show>
    </Button>
  );
};

export const Search = () => {
  const navigate = useNavigate();
  let searchInput!: HTMLInputElement;
  const rpc = new Client({
    handler: simpleFetchHandler({ service: "https://public.api.bsky.app" }),
  });
  const [recentSearches, setRecentSearches] = createSignal<RecentSearch[]>(getRecentSearches());

  onMount(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.target === searchInput) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (document.querySelector("[data-modal]")) return;

      const pastedText = e.clipboardData?.getData("text");
      if (pastedText) processInput(pastedText);
    };

    window.addEventListener("paste", handlePaste);
    onCleanup(() => window.removeEventListener("paste", handlePaste));
  });

  createEffect(() => {
    if (showSearch()) {
      searchInput.focus();
    } else {
      setInput(undefined);
      setSelectedIndex(-1);
      setSearch(undefined);
    }
  });

  const fetchTypeahead = async (input: string | undefined) => {
    if (!input) return [];

    const { prefix, query } = parsePrefix(input);

    if (prefix === "@") {
      if (!query.length) return [];

      const res = await rpc.get("app.bsky.actor.searchActorsTypeahead", {
        params: { q: query, limit: 5 },
      });
      if (res.ok) {
        return res.data.actors;
      }
    }

    return [];
  };

  const [input, setInput] = createSignal<string>();
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [search, { mutate: setSearch }] = createResource(
    createDebouncedValue(input, 200),
    fetchTypeahead,
  );

  const getRecentSuggestions = () => {
    const currentInput = input()?.toLowerCase();
    if (!currentInput) return recentSearches();
    return recentSearches().filter((r) => r.label.toLowerCase().includes(currentInput));
  };

  const saveRecentSearch = (path: string, label: string, type: RecentSearch["type"]) => {
    addRecentSearch({ path, label, type });
    setRecentSearches(getRecentSearches());
  };

  const processInput = async (input: string) => {
    input = input.trim().replace(/^@/, "");
    if (!input.length) return;

    if (input.includes("%")) {
      try {
        input = decodeURIComponent(input);
      } catch {}
    }

    setShowSearch(false);

    const { prefix, query } = parsePrefix(input);

    if (prefix === "@") {
      const path = `/at://${query}`;
      saveRecentSearch(path, query, "handle");
      navigate(path);
    } else if (prefix === "did:") {
      const path = `/at://did:${query}`;
      saveRecentSearch(path, `did:${query}`, "did");
      navigate(path);
    } else if (prefix === "at:") {
      const path = `/${input}`;
      saveRecentSearch(path, input, "at-uri");
      navigate(path);
    } else if (prefix === "lex:") {
      if (query.split(".").length >= 3) {
        const nsid = query as Nsid;
        const res = await resolveLexiconAuthority(nsid);
        const path = `/at://${res}/com.atproto.lexicon.schema/${nsid}`;
        saveRecentSearch(path, query, "lexicon");
        navigate(path);
      } else {
        const did = await resolveLexiconAuthorityDirect(query);
        const path = `/at://${did}/com.atproto.lexicon.schema`;
        saveRecentSearch(path, query, "lexicon");
        navigate(path);
      }
    } else if (prefix === "pds:") {
      const path = `/${query}`;
      saveRecentSearch(path, query, "pds");
      navigate(path);
    } else if (input.startsWith("https://") || input.startsWith("http://")) {
      const hostLength = input.indexOf("/", 8);
      const host = input.slice(0, hostLength).replace("https://", "").replace("http://", "");

      if (!(host in appList)) {
        const path = `/${input.replace("https://", "").replace("http://", "").replace("/", "")}`;
        saveRecentSearch(path, input, "url");
        navigate(path);
      } else {
        const app = appList[host as AppUrl];
        const pathParts = input.slice(hostLength + 1).split("/");
        const uri = appHandleLink[app](pathParts);
        const path = `/${uri}`;
        saveRecentSearch(path, input, "url");
        navigate(path);
      }
    } else {
      const path = `/at://${input.replace("at://", "")}`;
      const type = input.split("/").length > 1 ? "at-uri" : "handle";
      saveRecentSearch(path, input, type);
      navigate(path);
    }
  };

  return (
    <Modal
      open={showSearch()}
      onClose={() => setShowSearch(false)}
      alignTop
      contentClass="dark:bg-dark-200 dark:shadow-dark-700 pointer-events-auto mx-3 w-full max-w-lg rounded-lg border-[0.5px] min-w-0 border-neutral-300 bg-white shadow-md dark:border-neutral-700"
    >
      <form
        class="w-full"
        onsubmit={(e) => {
          e.preventDefault();
          processInput(searchInput.value);
        }}
      >
        <label for="input" class="hidden">
          Search or paste a link
        </label>
        <div
          class={`flex items-center gap-2 px-3 ${
            getRecentSuggestions().length > 0 || search()?.length ? "rounded-t-lg" : "rounded-lg"
          }`}
        >
          <label
            for="input"
            class="iconify lucide--search text-neutral-500 dark:text-neutral-400"
          ></label>
          <input
            type="text"
            spellcheck={false}
            autocapitalize="off"
            autocomplete="off"
            placeholder="Search or paste a link..."
            ref={searchInput}
            id="input"
            class="grow py-2.5 select-none placeholder:text-sm focus:outline-none"
            value={input() ?? ""}
            onInput={(e) => {
              setInput(e.currentTarget.value);
              setSelectedIndex(-1);
            }}
            onBlur={() => setSelectedIndex(-1)}
            onKeyDown={(e) => {
              const results = search();
              const recent = getRecentSuggestions();
              const totalSuggestions = recent.length + (results?.length || 0);

              if (!totalSuggestions) return;

              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev === -1 ? 0 : (prev + 1) % totalSuggestions));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  prev === -1 ?
                    totalSuggestions - 1
                  : (prev - 1 + totalSuggestions) % totalSuggestions,
                );
              } else if (e.key === "Enter") {
                const index = selectedIndex();
                if (index >= 0) {
                  e.preventDefault();
                  if (index < recent.length) {
                    const item = recent[index];
                    addRecentSearch(item);
                    setRecentSearches(getRecentSearches());
                    setShowSearch(false);
                    navigate(item.path);
                  } else {
                    const adjustedIndex = index - recent.length;
                    if (results && results[adjustedIndex]) {
                      const actor = results[adjustedIndex];
                      const path = `/at://${actor.did}`;
                      saveRecentSearch(path, actor.handle, "handle");
                      setShowSearch(false);
                      navigate(path);
                    }
                  }
                } else if (results?.length && recent.length === 0) {
                  e.preventDefault();
                  const actor = results[0];
                  const path = `/at://${actor.did}`;
                  saveRecentSearch(path, actor.handle, "handle");
                  setShowSearch(false);
                  navigate(path);
                }
              }
            }}
          />
        </div>

        <Show when={getRecentSuggestions().length > 0 || search()?.length}>
          <div
            class={`flex w-full flex-col overflow-hidden border-t border-neutral-200 dark:border-neutral-700 ${input() ? "rounded-b-md" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* Recent searches */}
            <Show when={getRecentSuggestions().length > 0}>
              <div class="mt-2 mb-1 flex items-center justify-between px-3">
                <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Recent
                </span>
                <button
                  type="button"
                  class="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                  onClick={() => {
                    localStorage.removeItem(RECENT_SEARCHES_KEY);
                    setRecentSearches([]);
                  }}
                >
                  Clear all
                </button>
              </div>
              <For each={getRecentSuggestions()}>
                {(recent, index) => {
                  const icon =
                    recent.type === "handle" ? "lucide--at-sign"
                    : recent.type === "did" ? "lucide--user-round"
                    : recent.type === "at-uri" ? "lucide--link"
                    : recent.type === "lexicon" ? "lucide--book-open"
                    : recent.type === "pds" ? "lucide--hard-drive"
                    : "lucide--globe";
                  return (
                    <div
                      class={`group flex items-center ${
                        index() === selectedIndex() ?
                          "bg-neutral-200 dark:bg-neutral-700"
                        : "dark:hover:bg-dark-100 hover:bg-neutral-100"
                      }`}
                    >
                      <A
                        href={recent.path}
                        class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm"
                        onClick={() => {
                          addRecentSearch(recent);
                          setRecentSearches(getRecentSearches());
                          setShowSearch(false);
                        }}
                      >
                        <span
                          class={`iconify ${icon} shrink-0 text-neutral-500 dark:text-neutral-400`}
                        ></span>
                        <span class="truncate">{recent.label}</span>
                      </A>
                      <button
                        type="button"
                        class="mr-1 flex items-center rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                        onClick={() => {
                          removeRecentSearch(recent.path);
                          setRecentSearches(getRecentSearches());
                        }}
                      >
                        <span class="iconify lucide--x text-sm text-neutral-500 dark:text-neutral-400"></span>
                      </button>
                    </div>
                  );
                }}
              </For>
            </Show>

            {/* Typeahead results */}
            <For each={search()}>
              {(actor, index) => {
                const adjustedIndex = getRecentSuggestions().length + index();
                const path = `/at://${actor.did}`;
                return (
                  <A
                    class={`flex items-center gap-2 px-3 py-1.5 ${
                      adjustedIndex === selectedIndex() ?
                        "bg-neutral-200 dark:bg-neutral-700"
                      : "dark:hover:bg-dark-100 hover:bg-neutral-100 active:bg-neutral-200 dark:active:bg-neutral-700"
                    }`}
                    href={path}
                    onClick={() => {
                      saveRecentSearch(path, actor.handle, "handle");
                      setShowSearch(false);
                    }}
                  >
                    <img
                      src={actor.avatar?.replace("img/avatar/", "img/avatar_thumbnail/")}
                      class="size-8 rounded-full"
                    />
                    <div class="flex min-w-0 flex-col">
                      <Show when={actor.displayName}>
                        <span class="truncate text-sm font-medium">{actor.displayName}</span>
                      </Show>
                      <span class="truncate text-xs text-neutral-600 dark:text-neutral-400">
                        @{actor.handle}
                      </span>
                    </div>
                  </A>
                );
              }}
            </For>
          </div>
        </Show>
        <Show when={!input()}>
          <div class="flex flex-col gap-1 border-t border-neutral-200 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            <div class="flex flex-wrap gap-1.5">
              <div>
                @<span class="text-neutral-400 dark:text-neutral-500">retr0.id</span>
              </div>
              <div>did:</div>
              <div>at://</div>
              <div>
                lex:
                <span class="text-neutral-400 dark:text-neutral-500">app.bsky.feed.post</span>
              </div>
              <div>
                pds:
                <span class="text-neutral-400 dark:text-neutral-500">tngl.sh</span>
              </div>
            </div>
            <span>Bluesky, Tangled, Pinksea, or Frontpage links</span>
          </div>
        </Show>
      </form>
    </Modal>
  );
};
