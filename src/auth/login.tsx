import { createSignal, Show } from "solid-js";

import "./oauth-config";
import { useOAuthScopeFlow } from "./scope-flow";
import { ScopeSelector } from "./scope-selector";

export const Login = () => {
  const [notice, setNotice] = createSignal("");
  const [loginInput, setLoginInput] = createSignal("");

  const scopeFlow = useOAuthScopeFlow({
    onError: (e) => setNotice(`${e}`),
  });

  const initiateLogin = (handle: string) => {
    setNotice("");
    scopeFlow.initiate(handle);
  };

  const handleCancel = () => {
    scopeFlow.cancel();
    setLoginInput("");
    setNotice("");
  };

  return (
    <div class="flex flex-col gap-y-3">
      <Show when={!scopeFlow.showScopeSelector()}>
        <div>
          <h1 class="text-lg font-semibold">Add account</h1>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            Sign in with an AT Protocol account.
          </p>
        </div>
        <form
          class="flex flex-col gap-3"
          onsubmit={(event) => {
            event.preventDefault();
            initiateLogin(loginInput());
          }}
        >
          <label for="username" class="text-sm font-medium">
            Handle or DID
          </label>
          <input
            type="text"
            spellcheck={false}
            placeholder="user.bsky.social"
            id="username"
            name="username"
            autocomplete="username"
            ref={(el) => setTimeout(() => el.focus())}
            aria-label="Your AT Protocol handle"
            class="dark:bg-dark-100 rounded-lg bg-white px-2.5 py-2 outline-1 outline-neutral-200 select-none focus:outline-neutral-400 dark:outline-neutral-600 dark:focus:outline-neutral-400"
            onInput={(e) => setLoginInput(e.currentTarget.value)}
          />
          <button
            type="submit"
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500/90 px-3 py-2 text-white hover:bg-blue-500 active:bg-blue-600 dark:bg-blue-500/80 dark:hover:bg-blue-500/90 dark:active:bg-blue-500"
          >
            Continue
          </button>
        </form>
      </Show>

      <Show when={scopeFlow.showScopeSelector()}>
        <div>
          <h1 class="text-lg font-semibold">Choose permissions</h1>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">{scopeFlow.pendingAccount()}</p>
        </div>
        <ScopeSelector
          onConfirm={scopeFlow.complete}
          onCancel={handleCancel}
          cancelLabel="Use a different account"
        />
      </Show>

      <Show when={notice()}>
        <div class="text-sm">{notice()}</div>
      </Show>
    </div>
  );
};
