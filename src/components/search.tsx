import { resolveHandle } from "../utils/api.js";
import { A } from "@solidjs/router";
import Tooltip from "./tooltip.jsx";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { agent, loginState } from "../components/login.jsx";
import { Handle } from "@atcute/lexicons";

const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 1;

const Search = () => {
  let searchInput!: HTMLInputElement;
  const [loading, setLoading] = createSignal(false);

  const processInput = async (input: string) => {
    (document.getElementById("uriForm") as HTMLFormElement).reset();
    input = input.trim();
    if (!input.length) return;
    if (
      !input.startsWith("https://bsky.app/") &&
      !input.startsWith("https://deer.social/") &&
      (input.startsWith("https://") || input.startsWith("http://"))
    ) {
      window.location.href = `/${input.replace("https://", "").replace("http://", "").replace("/", "")}`;
      return;
    }

    const uri = input
      .replace("at://", "")
      .replace("https://deer.social/profile/", "")
      .replace("https://bsky.app/profile/", "")
      .replace("/post/", "/app.bsky.feed.post/");
    const uriParts = uri.split("/");
    const actor = uriParts[0];
    let did = "";
    try {
      setLoading(true);
      did = uri.startsWith("did:") ? actor : await resolveHandle(actor as Handle);
      setLoading(false);
    } catch {
      window.location.href = `/${actor}`;
      return;
    }
    window.location.href = `/at://${did}${uriParts.length > 1 ? `/${uriParts.slice(1).join("/")}` : ""}`;
  };

  onMount(() => window.addEventListener("keydown", keyEvent));
  onCleanup(() => window.removeEventListener("keydown", keyEvent));

  const keyEvent = (event: KeyboardEvent) => {
    if (document.querySelector("dialog")) return;

    if (event.key == "/" && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key == "Escape" && document.activeElement === searchInput) {
      event.preventDefault();
      searchInput.blur();
    }
  };

  return (
    <form
      class="flex w-full max-w-[21rem] flex-col sm:max-w-[23rem]"
      id="uriForm"
      onsubmit={(e) => e.preventDefault()}
    >
      <div class="w-full">
        <label for="input" class="ml-0.5 text-sm">
          PDS URL or AT URI
        </label>
      </div>
      <div class="flex w-full items-center gap-2">
        <div class="dark:bg-dark-100 focus-within:outline-1.5 flex grow items-center gap-2 rounded-lg bg-white px-2 py-1 shadow-sm focus-within:outline-blue-500">
          <input
            type="text"
            spellcheck={false}
            ref={searchInput}
            id="input"
            placeholder={isTouchDevice ? "" : "Type / to search"}
            class="grow focus:outline-none"
          />
          <Show when={loading()}>
            <div class="i-lucide-loader-circle animate-spin text-lg" />
          </Show>
          <Show when={!loading()}>
            <button type="submit" onclick={() => processInput(searchInput.value)}>
              <div class="i-lucide-search text-lg text-neutral-500 dark:text-neutral-400" />
            </button>
          </Show>
        </div>
        <Show when={loginState()}>
          <Tooltip
            text="Repository"
            children={
              <A href={`/at://${agent.sub}`} class="flex">
                <div class="i-lucide-house text-xl" />
              </A>
            }
          />
        </Show>
      </div>
    </form>
  );
};

export { Search };
