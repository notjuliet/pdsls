import { Client, CredentialManager } from "@atcute/client";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { isTouchDevice } from "../layout";
import { appHandleLink, appList, appName, AppUrl } from "../utils/app-urls";
import { createDebouncedValue } from "../utils/hooks/debounced";
import { Modal } from "./modal";

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
      class={`flex items-center gap-0.5 rounded-lg ${isTouchDevice ? "p-1 text-xl hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600" : "dark:bg-dark-100/70 box-border h-7 border-[0.5px] border-neutral-300 bg-neutral-100/70 p-1.5 text-xs hover:bg-neutral-200 active:bg-neutral-300 dark:border-neutral-600 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"}`}
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
  const [search] = createResource(createDebouncedValue(input, 250), fetchTypeahead);

  const processInput = (input: string) => {
    input = input.trim().replace(/^@/, "");
    if (!input.length) return;
    setShowSearch(false);
    if (search()?.length) {
      navigate(`/at://${search()![0].did}`);
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
        PDS URL, AT URI, or handle
      </label>
      <div class="dark:bg-dark-100 dark:shadow-dark-800 flex items-center gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 shadow-xs focus-within:outline-[1px] focus-within:outline-neutral-600 dark:border-neutral-600 dark:focus-within:outline-neutral-400">
        <label
          for="input"
          class="iconify lucide--search text-neutral-500 dark:text-neutral-400"
        ></label>
        <input
          type="text"
          spellcheck={false}
          placeholder="PDS URL, AT URI, DID, or handle"
          ref={searchInput}
          id="input"
          class="grow py-1 select-none placeholder:text-sm focus:outline-none"
          value={input() ?? ""}
          onInput={(e) => setInput(e.currentTarget.value)}
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
      <Show when={search()?.length && input()}>
        <div class="dark:bg-dark-300 dark:shadow-dark-800 absolute z-30 mt-1 flex w-full flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 shadow-md transition-opacity duration-200 dark:border-neutral-700 starting:opacity-0">
          <For each={search()}>
            {(actor) => (
              <A
                class="flex items-center gap-2 rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                href={`/at://${actor.did}`}
                onClick={() => setShowSearch(false)}
              >
                <img
                  src={actor.avatar?.replace("img/avatar/", "img/avatar_thumbnail/")}
                  class="size-8 rounded-full"
                />
                <span>{actor.handle}</span>
              </A>
            )}
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
        <div class="dark:bg-dark-300 dark:shadow-dark-800 absolute top-16 left-[50%] w-[22rem] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 sm:w-[26rem] dark:border-neutral-700 starting:opacity-0">
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
