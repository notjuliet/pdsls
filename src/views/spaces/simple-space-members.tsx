import type { Handle } from "@atcute/lexicons";
import { isDid, isHandle } from "@atcute/lexicons/syntax";
import { A } from "@solidjs/router";
import { createEffect, createSignal, For, Show } from "solid-js";

import { SPACE_MANAGE_SPACES_SCOPE_ID } from "../../auth/scope-utils.js";
import { Button } from "../../components/button.jsx";
import DidHoverCard from "../../components/hover-card/did.jsx";
import { Modal } from "../../components/modal.jsx";
import { addNotification, removeNotification } from "../../components/notification.jsx";
import { PermissionButton } from "../../components/permission-button.jsx";
import { TextInput } from "../../components/text-input.jsx";
import { resolveHandle } from "../../lib/api.js";
import {
  addSimpleSpaceMember,
  listSimpleSpaceMembers,
  removeSimpleSpaceMember,
  type SimpleSpaceMember,
} from "../../lib/spaces.js";
import { useSpacesAuth } from "./context.jsx";
import { ErrorNotice, LoadingState } from "./shared.jsx";

type MemberDialog = { kind: "add" } | { kind: "remove"; did: string };

const actionButtonClass =
  "flex items-center gap-1 rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs transition-colors hover:bg-neutral-200/50 active:bg-neutral-200 sm:px-2 sm:py-0.75 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:active:bg-neutral-700";

const notify = (message: string, type: "success" | "error", duration = 3000) => {
  const notification = addNotification({ message, type });
  setTimeout(() => removeNotification(notification), duration);
};

export const SimpleSpaceMembers = (props: { space: string; authority: string }) => {
  const auth = useSpacesAuth();
  const [members, setMembers] = createSignal<SimpleSpaceMember[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [dialog, setDialog] = createSignal<MemberDialog>();
  const [memberIdentifier, setMemberIdentifier] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [dialogError, setDialogError] = createSignal("");
  let activeKey = "";
  let requestVersion = 0;

  const canManage = () => props.authority === auth().sub;
  const removingDid = () => {
    const current = dialog();
    return current?.kind === "remove" ? current.did : undefined;
  };

  const loadMembers = async (reset = false, version = requestVersion) => {
    if (loading() && !reset) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await listSimpleSpaceMembers(auth(), props.space, {
        cursor: reset ? undefined : cursor(),
      });
      if (version !== requestVersion) return;
      setMembers((current) => {
        const next = reset ? result.members : [...current, ...result.members];
        return Array.from(new Map(next.map((member) => [member.did, member])).values());
      });
      setCursor(result.cursor);
      setLoaded(true);
    } catch (err) {
      if (version !== requestVersion) return;
      setError(err instanceof Error ? err.message : "Could not load SimpleSpace members");
      setLoaded(true);
    } finally {
      if (version === requestVersion) setLoading(false);
    }
  };

  const refreshMembers = () => {
    const version = ++requestVersion;
    void loadMembers(true, version);
  };

  createEffect(() => {
    const key = `${auth().sub}\n${props.space}`;
    if (key !== activeKey) {
      activeKey = key;
      requestVersion += 1;
      setMembers([]);
      setCursor(undefined);
      setLoaded(false);
      setLoading(false);
      setError(undefined);
      setDialog(undefined);
    }
    if (canManage() && !loaded() && !loading()) void loadMembers(true, requestVersion);
  });

  const openAddDialog = () => {
    setMemberIdentifier("");
    setDialogError("");
    setDialog({ kind: "add" });
  };

  const openRemoveDialog = (did: string) => {
    setDialogError("");
    setDialog({ kind: "remove", did });
  };

  const closeDialog = () => {
    if (!submitting()) setDialog(undefined);
  };

  const resolveMemberDid = async () => {
    const identifier = memberIdentifier().trim();
    if (isDid(identifier)) return identifier;
    if (!isHandle(identifier)) throw new Error("Enter a valid handle or DID");

    try {
      return await resolveHandle(identifier as Handle);
    } catch {
      throw new Error("Could not resolve that handle");
    }
  };

  const submit = async () => {
    const current = dialog();
    if (submitting() || !current) return;

    setSubmitting(true);
    setDialogError("");
    try {
      if (current.kind === "remove") {
        await removeSimpleSpaceMember(auth(), props.space, current.did);
        notify("Member removed", "success");
      } else {
        const did = await resolveMemberDid();
        await addSimpleSpaceMember(auth(), props.space, did);
        notify("Member added", "success");
      }
      setDialog(undefined);
      refreshMembers();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Could not update the member list");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section class="flex flex-col gap-2">
      <div class="flex items-center gap-2 px-2 text-sm">
        <h2 class="font-medium">Members</h2>
        <Show when={canManage() && loaded()}>
          <span class="text-xs text-neutral-500 dark:text-neutral-400">
            {members().length.toLocaleString()} {cursor() ? "loaded" : ""}
          </span>
        </Show>
        <Show when={canManage()}>
          <PermissionButton
            scope={SPACE_MANAGE_SPACES_SCOPE_ID}
            class={actionButtonClass}
            disabledClass={`${actionButtonClass} opacity-40`}
            onClick={openAddDialog}
          >
            <span class="iconify lucide--user-plus" />
            <span>Add</span>
          </PermissionButton>
        </Show>
      </div>

      <Show
        when={canManage()}
        fallback={
          <p class="px-2 text-xs text-neutral-500 dark:text-neutral-400">
            The member list is only available to the Space authority.
          </p>
        }
      >
        <Show when={loading() && !loaded()}>
          <LoadingState label="Loading members…" />
        </Show>

        <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

        <Show when={loaded()}>
          <ul class="flex flex-col">
            <For each={members()}>
              {(member) => (
                <li class="group relative flex min-w-0 items-center rounded hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700">
                  <DidHoverCard
                    did={member.did}
                    class="min-w-0 flex-1"
                    renderTrigger={({ loading: hoverLoading }) => (
                      <A
                        href={`/at://${member.did}`}
                        class="flex min-w-0 items-center p-2 pr-10 text-left text-sm"
                        classList={{ "hover-card-trigger-loading": hoverLoading() }}
                      >
                        <span class="min-w-0 truncate font-medium text-blue-500 dark:text-blue-400">
                          {member.did}
                        </span>
                      </A>
                    )}
                  />
                  <PermissionButton
                    scope={SPACE_MANAGE_SPACES_SCOPE_ID}
                    class="absolute inset-y-0 right-1 flex w-8 items-center justify-center rounded text-neutral-500 opacity-60 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 dark:text-neutral-400 dark:hover:text-red-400"
                    disabledClass="absolute inset-y-0 right-1 flex w-8 items-center justify-center rounded text-neutral-500 opacity-40 sm:opacity-0 sm:group-hover:opacity-40 dark:text-neutral-400"
                    onClick={() => openRemoveDialog(member.did)}
                  >
                    <span class="iconify lucide--user-minus" />
                    <span class="sr-only">Remove {member.did}</span>
                  </PermissionButton>
                </li>
              )}
            </For>
          </ul>

          <Show when={members().length === 0 && !error()}>
            <p class="px-2 text-xs text-neutral-500 dark:text-neutral-400">
              No additional members.
            </p>
          </Show>

          <Show when={cursor()}>
            <Button
              onClick={() => void loadMembers()}
              disabled={loading()}
              classList={{ "w-fit self-center": true }}
            >
              <Show when={loading()} fallback={<span class="iconify lucide--chevrons-down" />}>
                <span class="iconify lucide--loader-circle animate-spin" />
              </Show>
              Load more members
            </Button>
          </Show>
        </Show>
      </Show>

      <Modal
        open={dialog() !== undefined}
        onClose={closeDialog}
        closeOnClick={false}
        alignTop
        contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto flex w-[calc(100%-1rem)] max-w-sm flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold">{removingDid() ? "Remove member?" : "Add member"}</h2>
          <button
            type="button"
            aria-label="Close"
            onclick={closeDialog}
            class="flex items-center rounded-lg p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
          >
            <span class="iconify lucide--x" />
          </button>
        </div>

        <form
          class="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Show
            when={removingDid()}
            fallback={
              <div class="flex flex-col gap-1">
                <label for="simple-space-member" class="text-sm font-medium">
                  Handle or DID
                </label>
                <TextInput
                  id="simple-space-member"
                  class="w-full"
                  placeholder="alice.example.com"
                  value={memberIdentifier()}
                  disabled={submitting()}
                  onInput={(event) => setMemberIdentifier(event.currentTarget.value)}
                />
              </div>
            }
          >
            {(did) => (
              <p class="text-sm wrap-anywhere text-neutral-600 dark:text-neutral-400">
                Remove <span class="text-neutral-900 dark:text-neutral-200">{did()}</span> from this
                Space?
              </p>
            )}
          </Show>

          <Show when={dialogError()}>
            <div class="text-sm text-red-500 dark:text-red-400">{dialogError()}</div>
          </Show>

          <div class="flex justify-end gap-2">
            <Button disabled={submitting()} onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting()}
              classList={{
                "bg-blue-500! text-white! hover:bg-blue-600! active:bg-blue-700! dark:bg-blue-600! dark:hover:bg-blue-500! dark:active:bg-blue-400! border-none! disabled:opacity-60":
                  !removingDid(),
                "bg-red-500! border-none! text-white! hover:bg-red-400! active:bg-red-400! disabled:opacity-60":
                  !!removingDid(),
              }}
            >
              <Show when={submitting()}>
                <span class="iconify lucide--loader-circle animate-spin" />
              </Show>
              {submitting()
                ? removingDid()
                  ? "Removing…"
                  : "Adding…"
                : removingDid()
                  ? "Remove"
                  : "Add"}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
