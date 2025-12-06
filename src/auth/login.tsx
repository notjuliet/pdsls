import { createSignal, Show } from "solid-js";
import "./oauth-config";
import { useOAuthScopeFlow } from "./scope-flow";
import { ScopeSelector } from "./scope-selector";
import { retrieveSession } from "./session-manager";

// Re-export for backwards compatibility
export { agent, setAgent } from "./state";
export type { Sessions } from "./state";
export { retrieveSession };

interface LoginProps {
  onCancel?: () => void;
}

export const Login = (props: LoginProps) => {
  const [notice, setNotice] = createSignal("");
  const [loginInput, setLoginInput] = createSignal("");

  const scopeFlow = useOAuthScopeFlow({
    onError: (e) => setNotice(`${e}`),
    onRedirecting: () => {
      setNotice(`Contacting your data server...`);
      setTimeout(() => setNotice(`Redirecting...`), 0);
    },
  });

  const initiateLogin = (handle: string) => {
    setNotice("");
    scopeFlow.initiate(handle);
  };

  const handleCancel = () => {
    scopeFlow.cancel();
    setLoginInput("");
    setNotice("");
    props.onCancel?.();
  };

  return (
    <div class="flex flex-col gap-y-2 px-1">
      <Show when={!scopeFlow.showScopeSelector()}>
        <Show when={props.onCancel}>
          <div class="mb-1 flex items-center gap-2">
            <button
              onclick={handleCancel}
              class="flex items-center rounded-md p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
            >
              <span class="iconify lucide--arrow-left"></span>
            </button>
            <div class="font-semibold">Add account</div>
          </div>
        </Show>
        <form onsubmit={(e) => e.preventDefault()}>
          <label for="username" class="hidden">
            Add account
          </label>
          <div class="dark:bg-dark-100 dark:inset-shadow-dark-200 flex grow items-center gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 inset-shadow-xs focus-within:outline-[1px] focus-within:outline-neutral-600 dark:border-neutral-600 dark:focus-within:outline-neutral-400">
            <label
              for="username"
              class="iconify lucide--user-round-plus shrink-0 text-neutral-500 dark:text-neutral-400"
            ></label>
            <input
              type="text"
              spellcheck={false}
              placeholder="user.bsky.social"
              id="username"
              name="username"
              autocomplete="username"
              aria-label="Your AT Protocol handle"
              class="grow py-1 select-none placeholder:text-sm focus:outline-none"
              onInput={(e) => setLoginInput(e.currentTarget.value)}
            />
            <button
              onclick={() => initiateLogin(loginInput())}
              class="flex items-center rounded-md p-1 hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-600 dark:active:bg-neutral-500"
            >
              <span class="iconify lucide--log-in"></span>
            </button>
          </div>
        </form>
      </Show>

      <Show when={scopeFlow.showScopeSelector()}>
        <ScopeSelector
          account={scopeFlow.pendingAccount()}
          onConfirm={scopeFlow.complete}
          onCancel={handleCancel}
        />
      </Show>

      <Show when={notice()}>
        <div class="text-sm">{notice()}</div>
      </Show>
    </div>
  );
};
