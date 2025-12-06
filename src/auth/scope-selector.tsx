import { createSignal, For } from "solid-js";
import { buildScopeString, GRANULAR_SCOPES } from "./scope-utils";

export { hasScope, hasUserScope, parseScopeString } from "./scope-utils";

interface ScopeSelectorProps {
  onConfirm: (scopeString: string) => void;
  onCancel: () => void;
  initialScopes?: Set<string>;
  account?: string;
}

export const ScopeSelector = (props: ScopeSelectorProps) => {
  const [selectedScopes, setSelectedScopes] = createSignal<Set<string>>(
    props.initialScopes || new Set(["create", "update", "delete", "blob"]),
  );

  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(scopeId)) {
        newSet.delete(scopeId);
      } else {
        newSet.add(scopeId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    const scopeString = buildScopeString(selectedScopes());
    props.onConfirm(scopeString);
  };

  return (
    <div class="flex flex-col gap-y-2 px-1">
      <div class="mb-1">
        <div class="text-sm font-semibold">Select permissions</div>
        {props.account && (
          <div class="text-xs text-neutral-600 dark:text-neutral-400">for {props.account}</div>
        )}
      </div>
      <div class="flex flex-col gap-y-2">
        <For each={GRANULAR_SCOPES}>
          {(scope) => (
            <div class="flex items-center gap-2">
              <input
                id={`scope-${scope.id}`}
                type="checkbox"
                checked={selectedScopes().has(scope.id)}
                onChange={() => toggleScope(scope.id)}
              />
              <label for={`scope-${scope.id}`} class="flex grow items-center gap-2 select-none">
                <span>{scope.label}</span>
              </label>
            </div>
          )}
        </For>
      </div>
      <div class="mt-2 flex gap-2">
        <button
          onclick={props.onCancel}
          class="rounded-lg border-[0.5px] border-neutral-300 bg-neutral-100 px-3 py-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:border-neutral-600 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:active:bg-neutral-500"
        >
          Cancel
        </button>
        <button
          onclick={handleConfirm}
          class="grow rounded-lg border-[0.5px] border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
