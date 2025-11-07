import { Client, CredentialManager } from "@atcute/client";
import { Nsid } from "@atcute/lexicons";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { isTouchDevice } from "../layout";
import { resolveLexiconAuthority } from "../utils/api";
import { appHandleLink, appList, appName, AppUrl } from "../utils/app-urls";
import { createDebouncedValue } from "../utils/hooks/debounced";
import { Modal } from "./modal";

export const [showSearch, setShowSearch] = createSignal(false);

const SEARCH_PREFIXES: { prefix: string; description: string }[] = [
  { prefix: "@", description: "example.com" },
  { prefix: "did:", description: "web:example.com" },
  { prefix: "at:", description: "//example.com/com.example.test/self" },
  { prefix: "lex:", description: "com.example.test" },
  { prefix: "pds:", description: "host.example.com" },
];

const parsePrefix = (input: string): { prefix: string | null; query: string } => {
  const matchedPrefix = SEARCH_PREFIXES.find((p) => input.startsWith(p.prefix));
  if (matchedPrefix) {
    return {
      prefix: matchedPrefix.prefix,
      query: input.slice(matchedPrefix.prefix.length),
    };
  }
  return { prefix: null, query: input };
};

const SearchButton = () => {
  onMount(() => window.addEventListener("keydown", keyEvent));
  onCleanup(() => window.removeEventListener("keydown", keyEvent));

  const keyEvent = (ev: KeyboardEvent) => {
    if (document.querySelector("[data-modal]")) return;

    if ((ev.ctrlKey || ev.metaKey) && ev.key == "k") {
      ev.preventDefault();
      setShowSearch(!showSearch());
    } else if (ev.key == "Escape") {
      ev.preventDefault();
      setShowSearch(false);
    }
  };

  return (
    <button
      onclick={() => setShowSearch(!showSearch())}
      class={`flex items-center gap-1 rounded-md ${isTouchDevice ? "p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600" : "dark:bg-dark-100/70 text-baseline mr-1 box-border h-7 border-[0.5px] border-neutral-300 bg-neutral-100/70 px-2 text-xs hover:bg-neutral-200 active:bg-neutral-300 dark:border-neutral-600 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"}`}
    >
      <span class={`iconify lucide--search ${isTouchDevice ? "text-lg" : ""}`}></span>
      <Show when={!isTouchDevice}>
        <kbd class="font-sans leading-none text-neutral-500 select-none dark:text-neutral-400">
          {/Mac/i.test(navigator.platform) ? "⌘" : "⌃"}K
        </kbd>
      </Show>
    </button>
  );
};

const Search = () => {
  const navigate = useNavigate();
  let searchInput!: HTMLInputElement;
  const rpc = new Client({
    handler: new CredentialManager({ service: "https://public.api.bsky.app" }),
  });

  onMount(() => {
    if (useLocation().pathname !== "/") searchInput.focus();

    const handlePaste = (e: ClipboardEvent) => {
      if (e.target === searchInput) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const pastedText = e.clipboardData?.getData("text");
      if (pastedText) processInput(pastedText);
    };

    window.addEventListener("paste", handlePaste);
    onCleanup(() => window.removeEventListener("paste", handlePaste));
  });

  const fetchTypeahead = async (input: string) => {
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
  const [isFocused, setIsFocused] = createSignal(false);
  const [search] = createResource(createDebouncedValue(input, 200), fetchTypeahead);

  const getPrefixSuggestions = () => {
    const currentInput = input();
    if (!currentInput) return SEARCH_PREFIXES;

    const { prefix } = parsePrefix(currentInput);
    if (prefix) return [];

    return SEARCH_PREFIXES.filter((p) => p.prefix.startsWith(currentInput.toLowerCase()));
  };

  const processInput = async (input: string) => {
    input = input.trim().replace(/^@/, "");
    if (!input.length) return;

    setShowSearch(false);
    setInput(undefined);
    setSelectedIndex(-1);

    const { prefix, query } = parsePrefix(input);

    if (prefix === "@") {
      navigate(`/at://${query}`);
    } else if (prefix === "did:") {
      navigate(`/at://did:${query}`);
    } else if (prefix === "at:") {
      navigate(`/${input}`);
    } else if (prefix === "lex:") {
      const nsid = query as Nsid;
      const res = await resolveLexiconAuthority(nsid);
      navigate(`/at://${res}/com.atproto.lexicon.schema/${nsid}`);
    } else if (prefix === "pds:") {
      navigate(`/${query}`);
    } else if (input.startsWith("https://") || input.startsWith("http://")) {
      const hostLength = input.indexOf("/", 8);
      const host = input.slice(0, hostLength).replace("https://", "").replace("http://", "");

      if (!(host in appList)) {
        navigate(`/${input.replace("https://", "").replace("http://", "").replace("/", "")}`);
      } else {
        const app = appList[host as AppUrl];
        const path = input.slice(hostLength + 1).split("/");

        const uri = appHandleLink[app](path);
        navigate(`/${uri}`);
      }
    } else {
      navigate(`/at://${input.replace("at://", "")}`);
    }
  };

  return (
    <form
      class="relative w-full"
      onsubmit={(e) => {
        e.preventDefault();
        processInput(searchInput.value);
      }}
    >
      <label for="input" class="hidden">
        PDS URL, AT URI, NSID, DID, or handle
      </label>
      <div class="dark:bg-dark-100 dark:shadow-dark-700 flex items-center gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 shadow-xs focus-within:outline-[1px] focus-within:outline-neutral-600 dark:border-neutral-600 dark:focus-within:outline-neutral-400">
        <label
          for="input"
          class="iconify lucide--search text-neutral-500 dark:text-neutral-400"
        ></label>
        <input
          type="text"
          spellcheck={false}
          placeholder="Handle, DID, AT URI, NSID, PDS"
          ref={searchInput}
          id="input"
          class="grow py-1 select-none placeholder:text-sm focus:outline-none"
          value={input() ?? ""}
          onInput={(e) => {
            setInput(e.currentTarget.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setSelectedIndex(-1);
            setIsFocused(false);
          }}
          onKeyDown={(e) => {
            const results = search();
            const prefixSuggestions = getPrefixSuggestions();
            const totalSuggestions = (prefixSuggestions.length || 0) + (results?.length || 0);

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
                if (index < prefixSuggestions.length) {
                  const selectedPrefix = prefixSuggestions[index];
                  setInput(selectedPrefix.prefix);
                  setSelectedIndex(-1);
                  searchInput.focus();
                } else {
                  const adjustedIndex = index - prefixSuggestions.length;
                  if (results && results[adjustedIndex]) {
                    setShowSearch(false);
                    setInput(undefined);
                    navigate(`/at://${results[adjustedIndex].did}`);
                    setSelectedIndex(-1);
                  }
                }
              } else if (results?.length && prefixSuggestions.length === 0) {
                e.preventDefault();
                setShowSearch(false);
                setInput(undefined);
                navigate(`/at://${results[0].did}`);
                setSelectedIndex(-1);
              }
            }
          }}
        />
        <Show when={input()} fallback={ListUrlsTooltip()}>
          <button
            type="button"
            class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-600 dark:active:bg-neutral-500"
            onClick={() => setInput(undefined)}
          >
            <span class="iconify lucide--x"></span>
          </button>
        </Show>
      </div>
      <Show when={isFocused() && (getPrefixSuggestions().length > 0 || search()?.length)}>
        <div
          class="dark:bg-dark-300 dark:shadow-dark-700 absolute z-30 mt-1 flex w-full flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 shadow-md transition-opacity duration-200 dark:border-neutral-700 starting:opacity-0"
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Prefix suggestions */}
          <For each={getPrefixSuggestions()}>
            {(prefixItem, index) => (
              <button
                type="button"
                class={`flex items-center rounded-lg p-2 transition-colors duration-150 ${
                  index() === selectedIndex() ?
                    "bg-neutral-200 dark:bg-neutral-700"
                  : "hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                }`}
                onClick={() => {
                  setInput(prefixItem.prefix);
                  setSelectedIndex(-1);
                  searchInput.focus();
                }}
              >
                <span class={`text-sm font-semibold`}>{prefixItem.prefix}</span>
                <span class="text-sm text-neutral-600 dark:text-neutral-400">
                  {prefixItem.description}
                </span>
              </button>
            )}
          </For>

          {/* Typeahead results */}
          <For each={search()}>
            {(actor, index) => {
              const adjustedIndex = getPrefixSuggestions().length + index();
              return (
                <A
                  class={`flex items-center gap-2 rounded-lg p-2 transition-colors duration-150 ${
                    adjustedIndex === selectedIndex() ?
                      "bg-neutral-200 dark:bg-neutral-700"
                    : "hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  }`}
                  href={`/at://${actor.did}`}
                  onClick={() => setShowSearch(false)}
                >
                  <img
                    src={actor.avatar?.replace("img/avatar/", "img/avatar_thumbnail/")}
                    class="size-8 rounded-full"
                  />
                  <span>{actor.handle}</span>
                </A>
              );
            }}
          </For>
        </div>
      </Show>
    </form>
  );
};

const ListUrlsTooltip = () => {
  const [openList, setOpenList] = createSignal(false);

  let urls: Record<string, AppUrl[]> = {};
  for (const [appUrl, appView] of Object.entries(appList)) {
    if (!urls[appView]) urls[appView] = [appUrl as AppUrl];
    else urls[appView].push(appUrl as AppUrl);
  }

  return (
    <>
      <Modal open={openList()} onClose={() => setOpenList(false)}>
        <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute top-16 left-[50%] w-88 -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 sm:w-104 dark:border-neutral-700 starting:opacity-0">
          <div class="mb-2 flex items-center gap-1 font-semibold">
            <span class="iconify lucide--link"></span>
            <span>Supported URLs</span>
          </div>
          <div class="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
            Links that will be parsed automatically, as long as all the data necessary is on the
            URL.
          </div>
          <div class="flex flex-col gap-2 text-sm">
            <For each={Object.entries(appName)}>
              {([appView, name]) => {
                return (
                  <div>
                    <p class="font-semibold">{name}</p>
                    <div class="grid grid-cols-2 gap-x-4 text-neutral-600 dark:text-neutral-400">
                      <For each={urls[appView]}>
                        {(url) => (
                          <a
                            href={`${url.startsWith("localhost:") ? "http://" : "https://"}${url}`}
                            target="_blank"
                            class="hover:underline active:underline"
                          >
                            {url}
                          </a>
                        )}
                      </For>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Modal>
      <button
        type="button"
        class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-600 dark:active:bg-neutral-500"
        onClick={() => setOpenList(true)}
      >
        <span class="iconify lucide--help-circle"></span>
      </button>
    </>
  );
};

export { Search, SearchButton };
