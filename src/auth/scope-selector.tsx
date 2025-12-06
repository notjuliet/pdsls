import { createSignal, For } from "solid-js";
import { buildScopeString, GRANULAR_SCOPES, scopeIdsToString } from "./scope-utils";

interface ScopeSelectorProps {
  onConfirm: (scopeString: string, scopeIds: string) => void;
  onCancel: () => void;
  initialScopes?: Set<string>;
}

export const ScopeSelector = (props: ScopeSelectorProps) => {
  const [selectedScopes, setSelectedScopes] = createSignal<Set<string>>(
    props.initialScopes || new Set(["create", "update", "delete", "blob"]),
  );

  const isBlobDisabled = () => {
    const scopes = selectedScopes();
    return !scopes.has("create") && !scopes.has("update");
  };

  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(scopeId)) {
        newSet.delete(scopeId);
        if (
          (scopeId === "create" || scopeId === "update") &&
          !newSet.has("create") &&
          !newSet.has("update")
        ) {
          newSet.delete("blob");
        }
      } else {
        newSet.add(scopeId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    const scopes = selectedScopes();
    const scopeString = buildScopeString(scopes);
    const scopeIds = scopeIdsToString(scopes);
    props.onConfirm(scopeString, scopeIds);
  };

  return (
    <div class="flex flex-col gap-y-2">
      <div class="mb-1 flex items-center gap-2">
        <button
          onclick={props.onCancel}
          class="flex items-center rounded-md p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          <span class="iconify lucide--arrow-left"></span>
        </button>
        <div class="font-semibold">Select permissions</div>
      </div>
      <div class="flex flex-col gap-y-2 px-1">
        <For each={GRANULAR_SCOPES}>
          {(scope) => (
            <div
              class="flex items-center gap-2"
              classList={{ "opacity-50": scope.id === "blob" && isBlobDisabled() }}
            >
              <input
                id={`scope-${scope.id}`}
                type="checkbox"
                checked={selectedScopes().has(scope.id)}
                disabled={scope.id === "blob" && isBlobDisabled()}
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
          onclick={handleConfirm}
          class="grow rounded-lg border-[0.5px] border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
