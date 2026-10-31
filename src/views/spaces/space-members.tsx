import type { Handle } from "@atcute/lexicons";
import { isDid, isHandle } from "@atcute/lexicons/syntax";
import { A } from "@solidjs/router";
import { createEffect, createSignal, For, Show } from "solid-js";

import { hasUserScope, SPACE_MANAGE_SPACES_SCOPE_ID } from "../../auth/scope-utils.js";
import DidHoverCard from "../../components/hover-card/did.jsx";
import { Button } from "../../components/ui/button.jsx";
import { IconButton } from "../../components/ui/icon-button.jsx";
import { HEADING_TEXT_CLASS, MUTED_CLASS } from "../../components/ui/info.jsx";
import { Modal } from "../../components/ui/modal.jsx";
import { addNotification } from "../../components/ui/notification.jsx";
import { PermissionButton } from "../../components/ui/permission-button.jsx";
import { showPermissionPrompt } from "../../components/ui/permission-prompt.jsx";
import { Spinner, ErrorNotice, LoadingState } from "../../components/ui/states.jsx";
import { TextInput } from "../../components/ui/text-input.jsx";
import { resolveHandle } from "../../lib/api.js";
import { LoadMoreSentinel } from "../../lib/infinite-scroll.jsx";
import {
  putSpaceMember,
  listSpaceMembers,
  removeSpaceMember,
  type SpaceMember,
} from "../../lib/spaces.js";
import { useSpacesAuth } from "./context.jsx";

/** The access a member can be given. Neither is left out: a member with no access is a removal. */
const ACCESS_OPTIONS = [
  { value: "read-write", label: "Read + write", read: true, write: true },
  { value: "read", label: "Read", read: true, write: false },
  { value: "write", label: "Write", read: false, write: true },
];

const accessValue = (member: { read: boolean; write: boolean }) =>
  ACCESS_OPTIONS.find((option) => option.read === member.read && option.write === member.write)
    ?.value ?? "none";

/** A small bordered button beside the heading, like the record Info tab's "Resolve and check". */
const actionButtonClass =
  "flex items-center gap-1 rounded-md border border-neutral-300 px-1.5 text-xs leading-5 transition-colors hover:bg-neutral-200/50 active:bg-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:active:bg-neutral-700";

export const SpaceMembers = (props: {
  space: string;
  authority: string;
  /** Whether reading and writing go by the member list rather than being open to anyone. */
  readUsesMembers: boolean;
  writeUsesMembers: boolean;
}) => {
  const auth = useSpacesAuth();
  const [members, setMembers] = createSignal<SpaceMember[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [adding, setAdding] = createSignal(false);
  const [memberIdentifier, setMemberIdentifier] = createSignal("");
  const [readAccess, setReadAccess] = createSignal(true);
  const [writeAccess, setWriteAccess] = createSignal(true);
  const [submitting, setSubmitting] = createSignal(false);
  const [dialogError, setDialogError] = createSignal("");
  // The member whose access is being saved from their row.
  const [savingDid, setSavingDid] = createSignal<string>();
  // The member whose row asks to confirm removing them, and whether that's going through.
  const [confirmingDid, setConfirmingDid] = createSignal<string>();
  const [removing, setRemoving] = createSignal(false);
  let activeKey = "";
  let requestVersion = 0;

  const canManage = () => props.authority === auth().sub;

  const loadMembers = async (reset = false, version = requestVersion) => {
    if (loading() && !reset) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await listSpaceMembers(auth(), props.space, {
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
      setError(err instanceof Error ? err.message : "Could not load the member list");
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
      setAdding(false);
      setConfirmingDid(undefined);
    }
    if (canManage() && !loaded() && !loading()) void loadMembers(true, requestVersion);
  });

  const openAddDialog = () => {
    setMemberIdentifier("");
    setReadAccess(true);
    setWriteAccess(true);
    setDialogError("");
    setAdding(true);
  };

  /** Saves a member's access as soon as it's picked on their row. */
  const changeAccess = async (member: SpaceMember, value: string) => {
    const option = ACCESS_OPTIONS.find((option) => option.value === value);
    if (!option || savingDid()) return;
    // Picked from the keyboard, which the label's pointer check doesn't catch.
    if (!hasUserScope(SPACE_MANAGE_SPACES_SCOPE_ID)) {
      showPermissionPrompt(SPACE_MANAGE_SPACES_SCOPE_ID);
      return;
    }

    setSavingDid(member.did);
    try {
      await putSpaceMember(auth(), props.space, {
        did: member.did,
        read: option.read,
        write: option.write,
      });
      setMembers((current) =>
        current.map((m) =>
          m.did === member.did ? { ...m, read: option.read, write: option.write } : m,
        ),
      );
    } catch (err) {
      addNotification({
        message: err instanceof Error ? err.message : "Could not update the member's access",
        type: "error",
        duration: 5000,
      });
    } finally {
      setSavingDid(undefined);
    }
  };

  const removeMember = async (did: string) => {
    if (removing()) return;
    setRemoving(true);
    try {
      await removeSpaceMember(auth(), props.space, did);
      setMembers((current) => current.filter((member) => member.did !== did));
      setConfirmingDid(undefined);
      addNotification({ message: "Member removed", type: "success", duration: 3000 });
    } catch (err) {
      addNotification({
        message: err instanceof Error ? err.message : "Could not remove the member",
        type: "error",
        duration: 5000,
      });
    } finally {
      setRemoving(false);
    }
  };

  const closeDialog = () => {
    if (!submitting()) setAdding(false);
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
    if (submitting()) return;

    setSubmitting(true);
    setDialogError("");
    try {
      const did = await resolveMemberDid();
      await putSpaceMember(auth(), props.space, {
        did,
        read: readAccess(),
        write: writeAccess(),
      });
      addNotification({ message: "Member added", type: "success", duration: 3000 });
      setAdding(false);
      refreshMembers();
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : "Could not add the member");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section class="flex flex-col gap-1">
      <div class="flex items-center gap-2 text-sm">
        <h3 class={HEADING_TEXT_CLASS}>Members</h3>
        <Show when={canManage() && loaded()}>
          <span class={MUTED_CLASS}>
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
          <p class={`text-sm ${MUTED_CLASS}`}>
            The member list is only available to the Space authority.
          </p>
        }
      >
        <Show when={loading() && !loaded()}>
          <LoadingState label="Loading members…" />
        </Show>

        <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

        <Show when={loaded()}>
          {/* Rows pad themselves for their hover highlight, so the list reaches out by that much. */}
          <ul class="-mx-2 flex flex-col">
            <For each={members()}>
              {(member) => (
                <li class="group relative flex min-w-0 items-center rounded hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700">
                  <DidHoverCard
                    did={member.did}
                    class="min-w-0 flex-1"
                    renderTrigger={({ loading: hoverLoading }) => (
                      <A
                        href={`/at://${member.did}`}
                        class="flex min-w-0 items-center p-2 text-left text-sm"
                        classList={{ "hover-card-trigger-loading": hoverLoading() }}
                      >
                        <span class="min-w-0 truncate font-medium text-blue-500 dark:text-blue-400">
                          {member.did}
                        </span>
                      </A>
                    )}
                  />
                  {/* Removing asks on the row itself, in place of the access and remove controls. */}
                  <Show
                    when={confirmingDid() === member.did}
                    fallback={
                      <>
                        {/* A label over a native select, like the Logs tab's event filter: the access
                      saves as soon as it's picked, without a dialog. */}
                        <label
                          class="relative flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-neutral-500 transition-colors hover:text-neutral-800 has-[:focus-visible]:outline has-[:focus-visible]:outline-neutral-400 dark:text-neutral-400 dark:hover:text-neutral-200"
                          onPointerDown={(event) => {
                            if (hasUserScope(SPACE_MANAGE_SPACES_SCOPE_ID)) return;
                            event.preventDefault();
                            showPermissionPrompt(SPACE_MANAGE_SPACES_SCOPE_ID);
                          }}
                        >
                          <span aria-hidden="true">
                            {ACCESS_OPTIONS.find((option) => option.value === accessValue(member))
                              ?.label ?? "No access"}
                          </span>
                          <Show
                            when={savingDid() === member.did}
                            fallback={
                              <span aria-hidden="true" class="iconify lucide--chevron-down" />
                            }
                          >
                            <Spinner />
                          </Show>
                          <select
                            aria-label={`Access for ${member.did}`}
                            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            value={accessValue(member)}
                            disabled={!!savingDid()}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              // Keep showing the saved access until the change goes through.
                              event.currentTarget.value = accessValue(member);
                              void changeAccess(member, value);
                            }}
                          >
                            {/* Only for members saved without access before, so the select can show it. */}
                            <Show when={accessValue(member) === "none"}>
                              <option value="none" disabled>
                                No access
                              </option>
                            </Show>
                            <For each={ACCESS_OPTIONS}>
                              {(option) => <option value={option.value}>{option.label}</option>}
                            </For>
                          </select>
                        </label>
                        <PermissionButton
                          scope={SPACE_MANAGE_SPACES_SCOPE_ID}
                          class="flex shrink-0 items-center rounded p-2 text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400"
                          disabledClass="flex shrink-0 items-center rounded p-2 opacity-40"
                          onClick={() => setConfirmingDid(member.did)}
                        >
                          <span class="iconify lucide--user-minus" />
                          <span class="sr-only">Remove {member.did}</span>
                        </PermissionButton>
                      </>
                    }
                  >
                    <div
                      class="flex shrink-0 items-center gap-1 pr-1 text-xs"
                      onKeyDown={(event) => {
                        if (event.key === "Escape" && !removing()) setConfirmingDid(undefined);
                      }}
                    >
                      <span class={`px-1 ${MUTED_CLASS}`}>Remove?</span>
                      <button
                        type="button"
                        // Focused first, so Enter right after clicking the icon doesn't remove.
                        ref={(el) => queueMicrotask(() => el.focus())}
                        disabled={removing()}
                        onClick={() => setConfirmingDid(undefined)}
                        class="rounded-md px-1.5 py-1 text-neutral-600 transition-colors hover:bg-neutral-300/60 disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={removing()}
                        onClick={() => void removeMember(member.did)}
                        class="flex items-center gap-1 rounded-md px-1.5 py-1 font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/15"
                      >
                        <Show when={removing()}>
                          <Spinner />
                        </Show>
                        {removing() ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  </Show>
                </li>
              )}
            </For>
          </ul>

          <Show when={members().length === 0 && !error()}>
            <p class={`text-sm ${MUTED_CLASS}`}>No additional members.</p>
          </Show>

          <Show when={cursor()}>
            <Button
              onClick={() => void loadMembers()}
              disabled={loading()}
              classList={{ "w-fit self-center": true }}
            >
              <Show when={loading()} fallback={<span class="iconify lucide--chevrons-down" />}>
                <Spinner />
              </Show>
              Load more members
            </Button>
            <LoadMoreSentinel
              hasMore={() => !!cursor() && !error()}
              loading={() => loading()}
              onLoadMore={() => void loadMembers()}
            />
          </Show>
        </Show>
      </Show>

      <Modal
        open={adding()}
        onClose={closeDialog}
        closeOnClick={false}
        alignTop
        contentClass="flex w-[calc(100%-1rem)] max-w-sm flex-col"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold">Add member</h2>
          <IconButton icon="lucide--x" label="Close" tooltip={false} onClick={closeDialog} />
        </div>

        <form
          class="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div class="flex flex-col gap-1">
            <label for="space-member" class="text-sm font-medium">
              Handle or DID
            </label>
            <TextInput
              id="space-member"
              class="w-full"
              placeholder="alice.example.com"
              value={memberIdentifier()}
              disabled={submitting()}
              onInput={(event) => setMemberIdentifier(event.currentTarget.value)}
            />
          </div>

          <fieldset disabled={submitting()} class="flex flex-col gap-2 text-sm">
            <legend class="mb-2 font-medium">Member access</legend>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={readAccess()}
                onChange={(event) => setReadAccess(event.currentTarget.checked)}
              />
              Read
            </label>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={writeAccess()}
                onChange={(event) => setWriteAccess(event.currentTarget.checked)}
              />
              Write
            </label>
            {/* Only when one kind of access does nothing in this space. */}
            <Show when={!props.readUsesMembers || !props.writeUsesMembers}>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                {props.readUsesMembers ? "Write" : "Read"} access does nothing here: anyone can{" "}
                {props.readUsesMembers ? "write" : "read"} in this space.
              </p>
            </Show>
          </fieldset>

          <Show when={dialogError()}>
            <div class="text-sm text-red-500 dark:text-red-400">{dialogError()}</div>
          </Show>

          <div class="flex justify-end gap-2">
            <Button disabled={submitting()} onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="submit"
              // Adding someone with neither kind of access wouldn't let them do anything.
              disabled={submitting() || (!readAccess() && !writeAccess())}
              variant="primary"
            >
              <Show when={submitting()}>
                <Spinner />
              </Show>
              {submitting() ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
};
