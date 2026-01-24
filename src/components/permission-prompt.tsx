import { createSignal } from "solid-js";
import { GRANULAR_SCOPES } from "../auth/scope-utils";
import { agent, setOpenManager, setPendingPermissionEdit } from "../auth/state";
import { Button } from "./button";
import { Modal } from "./modal";

type ScopeId = "create" | "update" | "delete" | "blob";

const [requestedScope, setRequestedScope] = createSignal<ScopeId | null>(null);

export const showPermissionPrompt = (scope: ScopeId) => {
  setRequestedScope(scope);
};

export const PermissionPromptContainer = () => {
  const scopeLabel = () => {
    const scope = GRANULAR_SCOPES.find((s) => s.id === requestedScope());
    return scope?.label.toLowerCase() || requestedScope();
  };

  const handleEditPermissions = () => {
    setRequestedScope(null);
    if (agent()) {
      setPendingPermissionEdit(agent()!.sub);
      setOpenManager(true);
    }
  };

  return (
    <Modal
      open={requestedScope() !== null}
      onClose={() => setRequestedScope(null)}
      contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto w-[calc(100%-2rem)] max-w-md rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
    >
      <h2 class="mb-2 font-semibold">Permission required</h2>
      <p class="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        You need the "{scopeLabel()}" permission to perform this action.
      </p>
      <div class="flex justify-end gap-2">
        <Button onClick={() => setRequestedScope(null)}>Cancel</Button>
        <Button
          onClick={handleEditPermissions}
          classList={{
            "bg-blue-500! text-white! hover:bg-blue-600! active:bg-blue-700! dark:bg-blue-600! dark:hover:bg-blue-500! dark:active:bg-blue-400! border-none!": true,
          }}
        >
          Edit permissions
        </Button>
      </div>
    </Modal>
  );
};
