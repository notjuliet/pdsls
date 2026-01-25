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
    <div class="flex flex-col gap-y-3">
      <div class="flex items-center gap-2">
        <button
          onclick={props.onCancel}
          class="flex items-center rounded-md p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          <span class="iconify lucide--arrow-left"></span>
        </button>
        <div class="font-semibold">Select permissions</div>
      </div>
      <div class="flex flex-col px-1">
        <For each={GRANULAR_SCOPES}>
          {(scope) => {
            const isSelected = () => selectedScopes().has(scope.id);
            const isDisabled = () => scope.id === "blob" && isBlobDisabled();

            return (
              <button
                onclick={() => !isDisabled() && toggleScope(scope.id)}
                disabled={isDisabled()}
                class="group flex items-center gap-3 py-2"
                classList={{ "opacity-50": isDisabled() }}
              >
                <div
                  class="flex size-5 items-center justify-center rounded border-2 transition-colors"
                  classList={{
                    "bg-blue-500 border-transparent group-hover:bg-blue-600 group-active:bg-blue-400":
                      isSelected() && !isDisabled(),
                    "border-neutral-400 dark:border-neutral-500 group-hover:border-neutral-500 dark:group-hover:border-neutral-400 group-hover:bg-neutral-100 dark:group-hover:bg-neutral-800":
                      !isSelected() && !isDisabled(),
                    "border-neutral-300 dark:border-neutral-600": isDisabled(),
                  }}
                >
                  {isSelected() && <span class="iconify lucide--check text-sm text-white"></span>}
                </div>
                <span>{scope.label}</span>
              </button>
            );
          }}
        </For>
      </div>
      <button
        onclick={handleConfirm}
        class="dark:hover:bg-dark-200 dark:active:bg-dark-100 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700"
      >
        Continue
      </button>
    </div>
  );
};
