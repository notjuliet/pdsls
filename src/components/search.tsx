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
    <>
      <form
        class="flex w-full max-w-[21rem] flex-col items-center sm:max-w-[23rem]"
        id="uriForm"
        onsubmit={(e) => e.preventDefault()}
      >
        <div class="w-full">
          <label for="input" class="ml-0.5 text-sm">
            PDS URL or AT URI
          </label>
        </div>
        <div class="flex w-full items-center gap-1">
          <input
            type="text"
            id="input"
            ref={searchInput}
            spellcheck={false}
            placeholder={isTouchDevice ? "" : "Type / to search"}
            class="dark:bg-dark-100 grow rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <div class="flex min-w-[2rem] justify-center">
            <Show when={loading()}>
              <div class="i-line-md-loading-twotone-loop text-xl" />
            </Show>
            <Show when={!loading()}>
              <button
                type="submit"
                onclick={() => processInput(searchInput.value)}
                class="i-lucide-square-arrow-right text-2xl"
              />
            </Show>
          </div>
          <Show when={loginState()}>
            <Tooltip
              text="Repository"
              children={
                <A href={`/at://${agent.sub}`} class="flex items-center">
                  <button class="i-lucide-git-fork-custom text-xl" />
                </A>
              }
            />
          </Show>
        </div>
      </form>
    </>
  );
};

export { Search };
