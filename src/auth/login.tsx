import { createSignal, Show } from "solid-js";
import "./oauth-config";
import { useOAuthScopeFlow } from "./scope-flow";
import { ScopeSelector } from "./scope-selector";

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
    <div class="flex flex-col gap-y-3">
      <Show when={!scopeFlow.showScopeSelector()}>
        <Show when={props.onCancel}>
          <div class="flex items-center gap-2">
            <button
              onclick={handleCancel}
              class="flex items-center rounded-md p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
            >
              <span class="iconify lucide--arrow-left"></span>
            </button>
            <div class="font-semibold">Add account</div>
          </div>
        </Show>
        <form class="flex flex-col gap-3" onsubmit={(e) => e.preventDefault()}>
          <label for="username" class="hidden">
            Add account
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
            onclick={() => initiateLogin(loginInput())}
            class="dark:hover:bg-dark-200 dark:active:bg-dark-100 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700"
          >
            Continue
          </button>
        </form>
      </Show>

      <Show when={scopeFlow.showScopeSelector()}>
        <ScopeSelector onConfirm={scopeFlow.complete} onCancel={handleCancel} />
      </Show>

      <Show when={notice()}>
        <div class="text-sm">{notice()}</div>
      </Show>
    </div>
  );
};
