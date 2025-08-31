import { resolveHandle } from "../utils/api.js";
import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { Handle } from "@atcute/lexicons";

const Search = () => {
  const navigate = useNavigate();
  let searchInput!: HTMLInputElement;
  const [loading, setLoading] = createSignal(false);

  const processInput = async (input: string) => {
    (document.getElementById("uriForm") as HTMLFormElement).reset();
    input = input
      .trim()
      .replace(/\u202c$/, "")
      .replace(/^\u202a/, "")
      .replace(/^@/, "");
    if (!input.length) return;
    if (
      !input.startsWith("https://bsky.app/") &&
      !input.startsWith("https://deer.social/") &&
      (input.startsWith("https://") || input.startsWith("http://"))
    ) {
      navigate(`/${input.replace("https://", "").replace("http://", "").replace("/", "")}`);
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
      setLoading(false);
      navigate(`/${actor}`);
      return;
    }
    navigate(`/at://${did}${uriParts.length > 1 ? `/${uriParts.slice(1).join("/")}` : ""}`);
  };

  return (
    <form
      class="flex w-full max-w-[22rem] flex-col sm:max-w-[24rem]"
      id="uriForm"
      onsubmit={(e) => e.preventDefault()}
    >
      <label for="input" class="ml-0.5 text-sm">
        PDS URL, AT URI, or handle
      </label>
      <div class="flex w-full items-center gap-2">
        <div class="dark:bg-dark-100 dark:shadow-dark-900/80 flex grow items-center gap-2 rounded-lg bg-white px-2 py-1 shadow-sm focus-within:outline-[1.5px] focus-within:outline-neutral-900 dark:focus-within:outline-neutral-200">
          <input
            type="text"
            spellcheck={false}
            ref={searchInput}
            id="input"
            class="grow focus:outline-none"
          />
          <Show when={loading()}>
            <span class="iconify lucide--loader-circle animate-spin text-lg"></span>
          </Show>
          <Show when={!loading()}>
            <button
              type="submit"
              class="iconify lucide--arrow-right text-lg text-neutral-500 dark:text-neutral-400"
              onclick={() => processInput(searchInput.value)}
            ></button>
          </Show>
        </div>
      </div>
    </form>
  );
};

export { Search };
