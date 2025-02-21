import { resolveHandle } from "../utils/api.js";
import { A, action, redirect, useSubmission } from "@solidjs/router";
import Tooltip from "./tooltip.jsx";
import { Show } from "solid-js";
import { agent, loginState } from "../components/login.jsx";

const processInput = action(async (formData: FormData) => {
  const input = formData.get("input")?.toString();
  (document.getElementById("uriForm") as HTMLFormElement).reset();
  if (!input) return new Error("Empty input");
  if (
    !input.startsWith("https://bsky.app/") &&
    !input.startsWith("https://main.bsky.dev/") &&
    (input.startsWith("https://") || input.startsWith("http://"))
  )
    throw redirect(
      `/${input.replace("https://", "").replace("http://", "").replace("/", "")}`,
    );

  const uri = input
    .replace("at://", "")
    .replace("https://bsky.app/profile/", "")
    .replace("https://main.bsky.dev/profile/", "")
    .replace("/post/", "/app.bsky.feed.post/");
  const uriParts = uri.split("/");
  const actor = uriParts[0];
  let did: string;
  try {
    did = uri.startsWith("did:") ? actor : await resolveHandle(actor);
  } catch {
    throw redirect(`/${actor}`);
  }
  throw redirect(
    `/at://${did}${uriParts.length > 1 ? `/${uriParts.slice(1).join("/")}` : ""}`,
  );
});

const Search = () => {
  const submission = useSubmission(processInput);

  return (
    <>
      <form
        class="flex flex-col items-center gap-y-1"
        id="uriForm"
        method="post"
        action={processInput}
      >
        <div class="w-full">
          <label for="input" class="ml-0.5 text-sm">
            PDS URL or AT URI
          </label>
        </div>
        <div class="flex items-center gap-x-2">
          <input
            type="text"
            id="input"
            name="input"
            spellcheck={false}
            class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <button
            type="submit"
            class="dark:bg-dark-700 dark:hover:bg-dark-800 rounded-lg border border-gray-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            Go
          </button>
          <Show when={loginState()}>
            <Tooltip
              text="Repository"
              children={
                <A href={`/at://${agent.sub}`} class="flex items-center">
                  <button class="i-tabler-binary-tree text-xl" />
                </A>
              }
            />
          </Show>
        </div>
      </form>
      <Show when={submission.error}>
        {(err) => <div class="mt-3">{err().message}</div>}
      </Show>
    </>
  );
};

export { Search };
