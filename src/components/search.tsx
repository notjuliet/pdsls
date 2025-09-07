import { useLocation, useNavigate } from "@solidjs/router";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { isTouchDevice } from "../layout";

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
      class={`flex items-center gap-0.5 rounded-lg ${isTouchDevice ? "p-1 text-xl hover:bg-neutral-200 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-700" : "dark:bg-dark-200 bg-neutral-200 p-1.5 text-xs hover:bg-neutral-300 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"}`}
    >
      <span class="iconify lucide--search"></span>
      <Show when={!isTouchDevice}>
        <kbd class="font-sans text-neutral-500 dark:text-neutral-400">
          {/Mac/i.test(navigator.platform) ? "⌘" : "⌃"}K
        </kbd>
      </Show>
    </button>
  );
};

const Search = () => {
  const navigate = useNavigate();
  let searchInput!: HTMLInputElement;

  onMount(() => {
    if (useLocation().pathname !== "/") searchInput.focus();
  });

  const processInput = async (input: string) => {
    input = input.trim().replace(/^@/, "");
    if (!input.length) return;
    setShowSearch(false);
    if (
      !input.startsWith("https://bsky.app/") &&
      (input.startsWith("https://") || input.startsWith("http://"))
    ) {
      navigate(`/${input.replace("https://", "").replace("http://", "").replace("/", "")}`);
      return;
    }

    const uri = input
      .replace("at://", "")
      .replace("https://bsky.app/profile/", "")
      .replace("/post/", "/app.bsky.feed.post/");
    const uriParts = uri.split("/");
    navigate(`/at://${uriParts[0]}${uriParts.length > 1 ? `/${uriParts.slice(1).join("/")}` : ""}`);
  };

  return (
    <form
      class="flex w-full max-w-[22rem] flex-col sm:max-w-[24rem]"
      id="uriForm"
      onsubmit={(e) => {
        e.preventDefault();
        processInput(searchInput.value);
      }}
    >
      <label for="input" class="hidden">
        PDS URL, AT URI, or handle
      </label>
      <div class="flex w-full items-center gap-2">
        <div class="dark:bg-dark-100 dark:shadow-dark-800 flex grow items-center gap-2 rounded-lg bg-white px-2 py-1 shadow-sm focus-within:outline-[1.5px] focus-within:outline-neutral-900 dark:focus-within:outline-neutral-200">
          <input
            type="text"
            spellcheck={false}
            placeholder="PDS URL, AT URI, or handle"
            ref={searchInput}
            id="input"
            class="grow placeholder:text-sm focus:outline-none"
          />
          <button
            type="submit"
            class="iconify lucide--arrow-right text-lg text-neutral-500 dark:text-neutral-400"
          ></button>
        </div>
      </div>
    </form>
  );
};

export { Search, SearchButton };
