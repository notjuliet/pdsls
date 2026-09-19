import { createSignal, Show } from "solid-js";

import { AlphaBadge } from "../components/alpha-badge.jsx";
import {
  buildScopeString,
  SPACE_MANAGE_RECORDS_SCOPE_ID,
  SPACE_MANAGE_SPACES_SCOPE_ID,
  SPACE_READ_SCOPE_ID,
} from "./scope-utils";

interface ScopeSelectorProps {
  onConfirm: (scopeString: string) => void | Promise<void>;
  onCancel?: () => void;
  cancelLabel?: string;
  initialScopes?: Set<string>;
  confirmLabel?: string;
}

const PermissionRow = (props: {
  label: string;
  description?: string;
  checked: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={props.checked}
    onclick={props.onClick}
    class="group flex w-full items-center gap-3 rounded-md py-2 text-left hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
  >
    <div
      class="flex size-5 shrink-0 items-center justify-center rounded border-2"
      classList={{
        "border-transparent bg-blue-500 group-hover:bg-blue-600 group-active:bg-blue-400":
          props.checked,
        "border-neutral-400 group-hover:border-neutral-500 dark:border-neutral-500 dark:group-hover:border-neutral-400":
          !props.checked,
      }}
    >
      <Show when={props.checked}>
        <span class="iconify lucide--check text-sm text-white"></span>
      </Show>
    </div>
    <span class="flex min-w-0 flex-col">
      <span class="text-sm font-medium">{props.label}</span>
      <Show when={props.description}>
        <span class="text-xs leading-4 text-neutral-600 dark:text-neutral-400">
          {props.description}
        </span>
      </Show>
    </span>
  </button>
);

export const ScopeSelector = (props: ScopeSelectorProps) => {
  const initialScopes = () => {
    // Space access is deliberately opt-in while the protocol is in alpha.
    const scopes = new Set(props.initialScopes || ["create", "update", "delete"]);
    scopes.delete("blob");
    if (scopes.has("create") || scopes.has("update")) {
      scopes.add("create");
      scopes.add("update");
    }
    if (scopes.has(SPACE_MANAGE_RECORDS_SCOPE_ID) || scopes.has(SPACE_MANAGE_SPACES_SCOPE_ID)) {
      scopes.add(SPACE_READ_SCOPE_ID);
    }
    return scopes;
  };
  const initial = initialScopes();
  const [selectedScopes, setSelectedScopes] = createSignal(initial);
  const [submitting, setSubmitting] = createSignal(false);

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

  const hasCreate = () => selectedScopes().has("create");
  const hasUpdate = () => selectedScopes().has("update");
  const hasWrite = () => hasCreate() && hasUpdate();

  const toggleWrite = () => {
    setSelectedScopes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has("create") && newSet.has("update")) {
        newSet.delete("create");
        newSet.delete("update");
      } else {
        newSet.add("create");
        newSet.add("update");
      }
      return newSet;
    });
  };

  const toggleSpaceRead = () => {
    setSelectedScopes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(SPACE_READ_SCOPE_ID)) {
        newSet.delete(SPACE_READ_SCOPE_ID);
        newSet.delete(SPACE_MANAGE_RECORDS_SCOPE_ID);
        newSet.delete(SPACE_MANAGE_SPACES_SCOPE_ID);
      } else {
        newSet.add(SPACE_READ_SCOPE_ID);
      }
      return newSet;
    });
  };

  const toggleSpaceManagement = () => {
    setSelectedScopes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(SPACE_MANAGE_SPACES_SCOPE_ID)) {
        newSet.delete(SPACE_MANAGE_SPACES_SCOPE_ID);
      } else {
        newSet.add(SPACE_READ_SCOPE_ID);
        newSet.add(SPACE_MANAGE_SPACES_SCOPE_ID);
      }
      return newSet;
    });
  };

  const toggleSpaceEdit = () => {
    setSelectedScopes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(SPACE_MANAGE_RECORDS_SCOPE_ID)) {
        newSet.delete(SPACE_MANAGE_RECORDS_SCOPE_ID);
      } else {
        newSet.add(SPACE_READ_SCOPE_ID);
        newSet.add(SPACE_MANAGE_RECORDS_SCOPE_ID);
      }
      return newSet;
    });
  };

  const handleConfirm = async () => {
    if (submitting()) return;
    setSubmitting(true);
    try {
      await props.onConfirm(buildScopeString(selectedScopes()));
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div class="flex flex-col gap-y-3">
      <div class="flex flex-col gap-4">
        <section>
          <div class="mb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
            Repository
          </div>
          <div class="flex flex-col">
            <PermissionRow
              label="Create and edit records"
              description="Includes file uploads."
              checked={hasWrite()}
              onClick={toggleWrite}
            />
            <PermissionRow
              label="Delete records"
              description="Also required to recreate records."
              checked={selectedScopes().has("delete")}
              onClick={() => toggleScope("delete")}
            />
          </div>
        </section>

        <section>
          <div class="mb-2 flex items-center gap-2">
            <span class="text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
              Spaces
            </span>
            <AlphaBadge />
          </div>
          <div class="flex flex-col">
            <PermissionRow
              label="View non-public records"
              description="Access records shared through Spaces."
              checked={selectedScopes().has(SPACE_READ_SCOPE_ID)}
              onClick={toggleSpaceRead}
            />
            <PermissionRow
              label="Write non-public records"
              description="Create, update, and delete non-public records."
              checked={selectedScopes().has(SPACE_MANAGE_RECORDS_SCOPE_ID)}
              onClick={toggleSpaceEdit}
            />
            <PermissionRow
              label="Manage Spaces"
              description="Create, configure, and delete Spaces."
              checked={selectedScopes().has(SPACE_MANAGE_SPACES_SCOPE_ID)}
              onClick={toggleSpaceManagement}
            />
          </div>
        </section>
      </div>
      <button
        disabled={submitting()}
        onclick={handleConfirm}
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500/90 px-3 py-2 text-white hover:bg-blue-500 active:bg-blue-600 disabled:opacity-70 dark:bg-blue-500/80 dark:hover:bg-blue-500/90 dark:active:bg-blue-500"
      >
        <Show when={submitting()} fallback={props.confirmLabel || "Continue"}>
          <span class="iconify lucide--loader-circle animate-spin"></span>
          <span>Preparing authorization…</span>
        </Show>
      </button>
      <Show when={props.onCancel && props.cancelLabel}>
        <button
          type="button"
          onclick={props.onCancel}
          class="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100 dark:active:bg-neutral-600"
        >
          {props.cancelLabel}
        </button>
      </Show>
    </div>
  );
};
