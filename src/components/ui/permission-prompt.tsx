import { useNavigate } from "@solidjs/router";
import { createEffect, createSignal } from "solid-js";

import { GRANULAR_SCOPES, type ScopeId } from "../../auth/scope-utils";
import { agent } from "../../auth/state";
import { Button } from "./button";
import { Modal } from "./modal";

const [requestedScope, setRequestedScope] = createSignal<ScopeId | null>(null);

export const showPermissionPrompt = (scope: ScopeId) => {
  setRequestedScope(scope);
};

export const PermissionPromptContainer = () => {
  const navigate = useNavigate();
  const [displayedScope, setDisplayedScope] = createSignal<ScopeId | null>(null);

  createEffect(() => {
    const scope = requestedScope();
    if (scope !== null) setDisplayedScope(scope);
  });

  const scopeLabel = () => {
    const scope = GRANULAR_SCOPES.find((s) => s.id === displayedScope());
    return scope?.label || displayedScope();
  };

  const handleEditPermissions = () => {
    setRequestedScope(null);
    if (agent()) {
      navigate(`/account/${agent()!.sub}/permissions`);
    }
  };

  return (
    <Modal
      open={requestedScope() !== null}
      onClose={() => setRequestedScope(null)}
      onClosed={() => setDisplayedScope(null)}
      contentClass="w-[calc(100%-2rem)] max-w-md"
    >
      <h2 class="mb-2 font-semibold">Permission required</h2>
      <p class="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
        Enable “{scopeLabel()}” in permissions to perform this action.
      </p>
      <div class="flex justify-end gap-2">
        <Button onClick={() => setRequestedScope(null)}>Cancel</Button>
        <Button onClick={handleEditPermissions} variant="primary">
          Edit permissions
        </Button>
      </div>
    </Modal>
  );
};
