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
import { Portal } from "solid-js/web";

import { agent, avatars, sessions } from "../auth/state.js";
import { resolveLexiconAuthority, resolveLexiconAuthorityDirect } from "../lib/api";
import { appHandleLink, appList, AppUrl } from "../lib/app-urls";
import { createDebouncedValue } from "../lib/debounced";
import { carFileAccept, createFileChangeHandler } from "../views/car/file-handlers.js";
import { queueCarFile } from "../views/car/state.js";

type RecentSearch = {
  path: string;
  label: string;
  type: "handle" | "did" | "at-uri" | "lexicon" | "pds" | "url";
};

type Destination = {
  href: string;
  label: string;
  icon: string;
  avatar?: string;
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
  const filtered = searches.filter((item) => item.path !== search.path);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify([search, ...filtered].slice(0, MAX_RECENT_SEARCHES)),
  );
};

const removeRecentSearch = (path: string) => {
  const searches = getRecentSearches();
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(searches.filter((item) => item.path !== path)),
  );
};

const SEARCH_PREFIXES = ["@", "did:", "at:", "lex:", "pds:"];

const parsePrefix = (input: string): { prefix: string | null; query: string } => {
  const matchedPrefix = SEARCH_PREFIXES.find((prefix) => input.toLowerCase().startsWith(prefix));
  if (!matchedPrefix) return { prefix: null, query: input };

  return {
    prefix: matchedPrefix,
    query: input.slice(matchedPrefix.length),
  };
};

const recentIcon = (type: RecentSearch["type"]) => {
  switch (type) {
    case "handle":
      return "lucide--at-sign";
    case "did":
      return "lucide--user-round";
    case "at-uri":
      return "lucide--link";
    case "lexicon":
      return "lucide--book-open";
    case "pds":
      return "lucide--hard-drive";
    case "url":
      return "lucide--globe";
  }
};

export const Search = () => {
  const navigate = useNavigate();
  const rpc = new Client({
    handler: simpleFetchHandler({ service: "https://public.api.bsky.app" }),
  });

  let searchRoot!: HTMLDivElement;
  let searchPanel!: HTMLDivElement;
  let searchInput!: HTMLInputElement;
  let fileInput!: HTMLInputElement;

  const [input, setInput] = createSignal<string>();
  const [showSearch, setShowSearch] = createSignal(false);
  const [selectedIndex, setSelectedIndex] = createSignal(-1);
  const [panelTop, setPanelTop] = createSignal(68);
  const [recentSearches, setRecentSearches] = createSignal<RecentSearch[]>(getRecentSearches());

  const fetchTypeahead = async (value: string | undefined) => {
    if (!value) return [];

    const { prefix, query } = parsePrefix(value);
    if (prefix !== null && prefix !== "@") return [];

    const actorQuery = prefix === "@" ? query : value;
    if (!actorQuery.length || actorQuery.includes("/") || /^https?:/i.test(actorQuery)) return [];

    const response = await rpc.get("app.bsky.actor.searchActorsTypeahead", {
      params: { q: actorQuery, limit: 5 },
    });
    return response.ok ? response.data.actors : [];
  };

  const debouncedInput = createDebouncedValue(input, 200);
  const [search, { mutate: setSearch }] = createResource(debouncedInput, fetchTypeahead);

  const actorSuggestions = () => (debouncedInput() === input() ? (search() ?? []) : []);

  const recentSuggestions = () => {
    return input() ? [] : recentSearches();
  };

  const accountDestinations = (): Destination[] => {
    const currentAgent = agent();
    return currentAgent
      ? [
          {
            href: `/at://${currentAgent.sub}`,
            label: sessions[currentAgent.sub]?.handle ?? currentAgent.sub,
            icon: "lucide--circle-user-round",
            avatar: avatars[currentAgent.sub]?.replace("img/avatar/", "img/avatar_thumbnail/"),
          },
          {
            href: "/spaces",
            label: "Spaces",
            icon: "lucide--lock-keyhole",
          },
        ]
      : [
          {
            href: "/account/add",
            label: "Sign in to manage records",
            icon: "lucide--log-in",
          },
        ];
  };

  const streamDestinations: Destination[] = [
    {
      href: "/streams?type=jetstream",
      label: "Jetstream",
      icon: "lucide--radio-tower",
    },
    {
      href: "/streams?type=firehose",
      label: "Firehose",
      icon: "lucide--rss",
    },
    {
      href: "/streams?type=spacedust",
      label: "Spacedust",
      icon: "lucide--sparkles",
    },
  ];

  const updatePanelPosition = () => {
    if (!searchRoot) return;
    setPanelTop(searchRoot.getBoundingClientRect().bottom + 6);
  };

  const resetSearch = () => {
    setInput();
    setSelectedIndex(-1);
    setSearch(undefined);
  };

  const closeSearch = (blur = false) => {
    setShowSearch(false);
    resetSearch();
    if (blur) searchInput?.blur();
  };

  const openSearch = () => {
    updatePanelPosition();
    setShowSearch(true);
  };

  const saveRecentSearch = (path: string, label: string, type: RecentSearch["type"]) => {
    addRecentSearch({ path, label, type });
    setRecentSearches(getRecentSearches());
  };

  const processInput = async (rawInput: string) => {
    let value = rawInput.trim();
    if (!value.length) return;

    if (value.includes("%")) {
      try {
        value = decodeURIComponent(value);
      } catch {}
    }

    closeSearch();
    const { prefix, query } = parsePrefix(value);

    if (prefix === "@") {
      const path = `/at://${query}`;
      saveRecentSearch(path, query, "handle");
      navigate(path);
    } else if (prefix === "did:") {
      const path = `/at://did:${query}`;
      saveRecentSearch(path, `did:${query}`, "did");
      navigate(path);
    } else if (prefix === "at:") {
      const path = `/${value}`;
      saveRecentSearch(path, value, "at-uri");
      navigate(path);
    } else if (prefix === "lex:") {
      if (query.split(".").length >= 3) {
        const nsid = query as Nsid;
        const authority = await resolveLexiconAuthority(nsid);
        const path = `/at://${authority}/com.atproto.lexicon.schema/${nsid}`;
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
    } else if (value.startsWith("https://") || value.startsWith("http://")) {
      const url = new URL(value);
      const host = url.hostname;

      if (!(host in appList)) {
        const path = `/${url.host}`;
        saveRecentSearch(path, value, "url");
        navigate(path);
      } else {
        const app = appList[host as AppUrl];
        const pathParts = url.pathname.slice(1).split("/");
        const uri = appHandleLink[app](pathParts);
        const path = `/${uri}`;
        saveRecentSearch(path, value, "url");
        navigate(path);
      }
    } else {
      const normalized = value.replace(/^@/, "").replace("at://", "");
      const path = `/at://${normalized}`;
      const type = normalized.split("/").length > 1 ? "at-uri" : "handle";
      saveRecentSearch(path, value, type);
      navigate(path);
    }
  };

  const openCarFile = createFileChangeHandler((file) => {
    queueCarFile(file);
    closeSearch();
    navigate("/car");
  });

  const openRecent = (recent: RecentSearch) => {
    addRecentSearch(recent);
    setRecentSearches(getRecentSearches());
    closeSearch();
    navigate(recent.path);
  };

  const openActor = (actor: { did: string; handle: string }) => {
    const path = `/at://${actor.did}`;
    saveRecentSearch(path, actor.handle, "handle");
    closeSearch();
    navigate(path);
  };

  const handleSearchKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch(true);
      return;
    }

    const actors = actorSuggestions();
    const recent = recentSuggestions();
    const totalSuggestions = recent.length + (actors?.length ?? 0);
    if (!totalSuggestions) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((previous) => (previous === -1 ? 0 : (previous + 1) % totalSuggestions));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((previous) =>
        previous === -1
          ? totalSuggestions - 1
          : (previous - 1 + totalSuggestions) % totalSuggestions,
      );
    } else if (event.key === "Enter") {
      const index = selectedIndex();
      if (index >= 0) {
        event.preventDefault();
        if (index < recent.length) openRecent(recent[index]);
        else if (actors?.[index - recent.length]) openActor(actors[index - recent.length]);
      } else if (actors?.length && recent.length === 0) {
        event.preventDefault();
        openActor(actors[0]);
      }
    }
  };

  onMount(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector("[data-modal]")) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      if (event.target === searchInput) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      if (document.querySelector("[data-modal]")) return;

      const pastedText = event.clipboardData?.getData("text");
      if (pastedText) void processInput(pastedText);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!searchRoot.contains(target) && !searchPanel?.contains(target)) closeSearch();
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    document.addEventListener("pointerdown", handlePointerDown);

    const requestUrl = new URL(location.href);
    const requestQuery = requestUrl.searchParams.get("q");
    if (requestQuery !== null) {
      requestUrl.searchParams.delete("q");
      history.replaceState(null, "", requestUrl.toString());
      void processInput(requestQuery);
    }

    onCleanup(() => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
    });
  });

  createEffect(() => {
    if (!showSearch()) return;
    updatePanelPosition();
    queueMicrotask(() => searchInput?.focus());
  });

  return (
    <div ref={searchRoot} class="min-w-0 flex-1">
      <input
        ref={fileInput}
        type="file"
        accept={carFileAccept}
        class="hidden"
        onChange={openCarFile}
      />
      <form
        role="search"
        class="flex h-9 min-w-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2 text-sm transition-colors focus-within:border-blue-400/70 dark:border-neutral-600 dark:bg-neutral-800 dark:focus-within:border-blue-400"
        onSubmit={(event) => {
          event.preventDefault();
          void processInput(searchInput.value);
        }}
      >
        <label
          for="global-search"
          class="iconify lucide--search shrink-0 text-neutral-500 dark:text-neutral-400"
        />
        <input
          ref={searchInput}
          id="global-search"
          type="text"
          spellcheck={false}
          autocapitalize="off"
          autocomplete="off"
          aria-label="Search or paste a link"
          aria-expanded={showSearch()}
          aria-controls="global-search-panel"
          placeholder="Search or paste..."
          class="min-w-0 flex-1 bg-transparent py-1 outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400"
          value={input() ?? ""}
          onFocus={openSearch}
          onInput={(event) => {
            setInput(event.currentTarget.value);
            setSelectedIndex(-1);
            openSearch();
          }}
          onKeyDown={handleSearchKeyDown}
        />
        <button
          type="button"
          title="Open CAR file"
          aria-label="Open CAR file"
          class="flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 active:bg-neutral-300 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 dark:active:bg-neutral-600"
          onClick={() => fileInput.click()}
        >
          <span class="iconify lucide--folder-archive" />
        </button>
      </form>

      <Show when={showSearch()}>
        <Portal>
          <div
            ref={searchPanel}
            id="global-search-panel"
            role="dialog"
            aria-label="Navigation and search results"
            style={{ top: `${panelTop()}px` }}
            class="dark:bg-dark-300 dark:shadow-dark-700 fixed left-1/2 z-50 flex max-h-[min(65vh,28rem)] w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 flex-col overflow-y-auto rounded-xl border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-sm shadow-lg dark:border-neutral-700"
          >
            <Show when={!input()}>
              <div class="grid grid-cols-2 gap-1">
                <For each={accountDestinations()}>
                  {(destination) => (
                    <A
                      href={destination.href}
                      class="flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2 hover:bg-neutral-200/60 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                      classList={{ "col-span-2": !agent() }}
                      onClick={() => closeSearch()}
                    >
                      <Show
                        when={destination.avatar}
                        fallback={
                          <span
                            class={`iconify ${destination.icon} shrink-0 text-base text-neutral-500 dark:text-neutral-400`}
                          />
                        }
                      >
                        <img src={destination.avatar} alt="" class="size-4 shrink-0 rounded-full" />
                      </Show>
                      <span class="truncate">{destination.label}</span>
                    </A>
                  )}
                </For>
              </div>

              <div class="mt-1 grid grid-cols-3 gap-1 border-t border-neutral-200 pt-1 dark:border-neutral-700">
                <For each={streamDestinations}>
                  {(destination) => (
                    <A
                      href={destination.href}
                      class="flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 hover:bg-neutral-200/60 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                      onClick={() => closeSearch()}
                    >
                      <span
                        class={`iconify ${destination.icon} shrink-0 text-neutral-500 dark:text-neutral-400`}
                      />
                      <span class="truncate">{destination.label}</span>
                    </A>
                  )}
                </For>
              </div>
            </Show>

            <Show when={recentSuggestions().length > 0}>
              <div class="mt-1 flex items-center justify-between border-t border-neutral-200 px-2 pt-2 pb-1.5 dark:border-neutral-700">
                <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Recent
                </span>
                <button
                  type="button"
                  class="text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                  onClick={() => {
                    localStorage.removeItem(RECENT_SEARCHES_KEY);
                    setRecentSearches([]);
                  }}
                >
                  Clear
                </button>
              </div>
              <For each={recentSuggestions()}>
                {(recent, index) => (
                  <div
                    class={`group flex items-center rounded-lg ${
                      index() === selectedIndex()
                        ? "bg-blue-50 dark:bg-blue-500/15"
                        : "hover:bg-neutral-200/60 dark:hover:bg-neutral-700"
                    }`}
                  >
                    <button
                      type="button"
                      class="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left"
                      onClick={() => openRecent(recent)}
                    >
                      <span
                        class={`iconify ${recentIcon(recent.type)} shrink-0 text-neutral-500 dark:text-neutral-400`}
                      />
                      <span class="truncate">{recent.label}</span>
                    </button>
                    <button
                      type="button"
                      title="Remove from recent searches"
                      aria-label={`Remove ${recent.label} from recent searches`}
                      class="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-neutral-300/60 hover:text-neutral-700 focus:opacity-100 dark:hover:bg-neutral-600 dark:hover:text-neutral-200"
                      onClick={() => {
                        removeRecentSearch(recent.path);
                        setRecentSearches(getRecentSearches());
                      }}
                    >
                      <span class="iconify lucide--x" />
                    </button>
                  </div>
                )}
              </For>
            </Show>

            <For each={actorSuggestions()}>
              {(actor, index) => {
                const adjustedIndex = recentSuggestions().length + index();
                return (
                  <button
                    type="button"
                    class={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${
                      adjustedIndex === selectedIndex()
                        ? "bg-blue-50 dark:bg-blue-500/15"
                        : "hover:bg-neutral-200/60 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    }`}
                    onClick={() => openActor(actor)}
                  >
                    <Show
                      when={actor.avatar}
                      fallback={
                        <span class="iconify lucide--circle-user-round size-8 shrink-0 text-neutral-400" />
                      }
                    >
                      <img
                        src={actor.avatar!.replace("img/avatar/", "img/avatar_thumbnail/")}
                        class="size-8 shrink-0 rounded-full"
                      />
                    </Show>
                    <span class="flex min-w-0 flex-col">
                      <Show when={actor.displayName}>
                        <span class="truncate font-medium">{actor.displayName}</span>
                      </Show>
                      <span class="truncate text-xs text-neutral-600 dark:text-neutral-400">
                        @{actor.handle}
                      </span>
                    </span>
                  </button>
                );
              }}
            </For>

            <Show when={input()}>
              <button
                type="button"
                class="mt-1 flex items-center gap-2 rounded-lg px-2 py-2 text-left text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-700"
                onClick={() => void processInput(input()!)}
              >
                <span class="iconify lucide--corner-down-left shrink-0" />
                <span class="min-w-0 truncate">
                  Open{" "}
                  <span class="font-medium text-neutral-900 dark:text-neutral-100">{input()}</span>
                </span>
              </button>
            </Show>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
