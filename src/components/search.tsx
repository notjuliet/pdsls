import { Client, CredentialManager } from "@atcute/client";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, onCleanup, onMount, Show, Suspense } from "solid-js";
import { isTouchDevice } from "../layout";
import { createDebouncedValue } from "../utils/hooks/debounced";

export const [showSearch, setShowSearch] = createSignal(false);

const SearchButton = () => {
  onMount(() => window.addEventListener("keydown", keyEvent));
  onCleanup(() => window.removeEventListener("keydown", keyEvent));

  const keyEvent = (ev: KeyboardEvent) => {
    if (document.querySelector("dialog")) return;

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
      class={`flex items-center gap-0.5 rounded-lg ${isTouchDevice ? "p-1 text-xl hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600" : "dark:bg-dark-200 bg-neutral-200 p-1.5 text-xs hover:bg-neutral-300/80 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"}`}
    >
      <span class="iconify lucide--search"></span>
      <Show when={!isTouchDevice}>
        <kbd class="font-sans text-neutral-500 select-none dark:text-neutral-400">
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
  });

  const fetchTypeahead = async (input: string) => {
    if (!input.length) return [];
    const res = await rpc.get("app.bsky.actor.searchActorsTypeahead", {
      params: { q: input, limit: 5 },
    });
    if (res.ok) {
      return res.data.actors;
    }
    return [];
  };

  const [input, setInput] = createSignal<string>();
  const [search] = createResource(createDebouncedValue(input, 300), fetchTypeahead);

  const processInput = (input: string) => {
    input = input.trim().replace(/^@/, "");
    if (!input.length) return;
    setShowSearch(false);
    if (input === "me" && localStorage.getItem("lastSignedIn") !== null) {
      navigate(`/at://${localStorage.getItem("lastSignedIn")}`);
    } else if (
      !input.startsWith("https://bsky.app/") &&
      (input.startsWith("https://") || input.startsWith("http://"))
    ) {
      navigate(`/${input.replace("https://", "").replace("http://", "").replace("/", "")}`);
    } else if (search()?.length) {
      navigate(`/at://${search()![0].did}`);
    } else {
      const uri = input
        .replace("at://", "")
        .replace("https://bsky.app/profile/", "")
        .replace("/post/", "/app.bsky.feed.post/");
      const uriParts = uri.split("/");
      navigate(
        `/at://${uriParts[0]}${uriParts.length > 1 ? `/${uriParts.slice(1).join("/")}` : ""}`,
      );
    }
    setShowSearch(false);
  };

  return (
    <form
      class="relative w-[22rem] sm:w-[24rem]"
      onsubmit={(e) => {
        e.preventDefault();
        processInput(searchInput.value);
      }}
    >
      <label for="input" class="hidden">
        PDS URL, AT URI, or handle
      </label>
      <div class="dark:bg-dark-100 dark:shadow-dark-800 flex items-center gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 py-1 shadow-xs focus-within:outline-[1.5px] focus-within:outline-neutral-900 dark:border-neutral-700 dark:focus-within:outline-neutral-200">
        <input
          type="text"
          spellcheck={false}
          placeholder="PDS URL, AT URI, or handle"
          ref={searchInput}
          id="input"
          class="grow select-none placeholder:text-sm focus:outline-none"
          value={input() ?? ""}
          onInput={(e) => setInput(e.currentTarget.value)}
        />
        <Show when={input()}>
          <button
            type="button"
            class="flex items-center rounded-lg p-0.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-600 dark:active:bg-neutral-500"
            onClick={() => setInput(undefined)}
          >
            <span class="iconify lucide--x text-lg"></span>
          </button>
        </Show>
      </div>
      <Show when={search()?.length && input()}>
        <div class="dark:bg-dark-300 absolute z-30 mt-2 flex w-full flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-1 dark:border-neutral-700">
          <Suspense fallback={<div class="p-1">Loading...</div>}>
            <For each={search()}>
              {(actor) => (
                <A
                  class="flex items-center gap-2 rounded-lg p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  href={`/at://${actor.did}`}
                  onClick={() => setShowSearch(false)}
                >
                  <img src={actor.avatar} class="size-6 rounded-full" />
                  <span>{actor.handle}</span>
                </A>
              )}
            </For>
          </Suspense>
        </div>
      </Show>
    </form>
  );
};

export { Search, SearchButton };
