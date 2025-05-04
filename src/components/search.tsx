import { resolveHandle } from "../utils/api.js";
import { A } from "@solidjs/router";
import Tooltip from "./tooltip.jsx";
import { createSignal, Show } from "solid-js";
import { agent, loginState } from "../components/login.jsx";

const Search = () => {
  let searchInput!: HTMLInputElement;
  const [loading, setLoading] = createSignal(false);

  const processInput = async (input: string) => {
    (document.getElementById("uriForm") as HTMLFormElement).reset();
    if (!input.trim().length) return;
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
      did = uri.startsWith("did:") ? actor : await resolveHandle(actor);
      setLoading(false);
    } catch {
      window.location.href = `/${actor}`;
      return;
    }
    window.location.href = `/at://${did}${uriParts.length > 1 ? `/${uriParts.slice(1).join("/")}` : ""}`;
  };

  return (
    <>
      <form
        class="flex flex-col items-center gap-y-1"
        id="uriForm"
        onsubmit={(e) => e.preventDefault()}
      >
        <div class="w-full">
          <label for="input" class="ml-0.5 text-sm">
            PDS URL or AT URI
          </label>
        </div>
        <div class="flex items-center gap-1">
          <input
            type="text"
            id="input"
            ref={searchInput}
            spellcheck={false}
            class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <div class="flex min-w-[2rem] justify-center">
            <Show when={loading()}>
              <div class="i-line-md-loading-twotone-loop text-xl" />
            </Show>
            <Show when={!loading()}>
              <button
                type="submit"
                onclick={() => processInput(searchInput.value)}
                class="i-lucide-arrow-right-square text-2xl"
              />
            </Show>
          </div>
          <Show when={loginState()}>
            <Tooltip
              text="Repository"
              children={
                <A href={`/at://${agent.sub}`} class="flex items-center">
                  <button class="i-lucide-git-fork text-xl" />
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
