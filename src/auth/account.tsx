import { Did } from "@atcute/lexicons";
import { deleteStoredSession, getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { A } from "@solidjs/router";
import { createEffect, For, onMount, Show } from "solid-js";
import { produce } from "solid-js/store";
import { ActionMenu, DropdownMenu, MenuProvider, NavMenu } from "../components/dropdown.jsx";
import { Modal } from "../components/modal.jsx";
import { Login } from "./login.jsx";
import { useOAuthScopeFlow } from "./scope-flow.js";
import { ScopeSelector } from "./scope-selector.jsx";
import { parseScopeString } from "./scope-utils.js";
import {
  getAvatar,
  loadHandleForSession,
  loadSessionsFromStorage,
  resumeSession,
  retrieveSession,
  saveSessionToStorage,
} from "./session-manager.js";
import {
  agent,
  avatars,
  openManager,
  pendingPermissionEdit,
  sessions,
  setAgent,
  setAvatars,
  setOpenManager,
  setPendingPermissionEdit,
  setSessions,
  setShowAddAccount,
  showAddAccount,
} from "./state.js";

const AccountDropdown = (props: { did: Did; onEditPermissions: (did: Did) => void }) => {
  const removeSession = async (did: Did) => {
    const currentSession = agent()?.sub;
    try {
      const session = await getSession(did, { allowStale: true });
      const agent = new OAuthUserAgent(session);
      await agent.signOut();
    } catch {
      deleteStoredSession(did);
    }
    setSessions(
      produce((accs) => {
        delete accs[did];
      }),
    );
    saveSessionToStorage(sessions);
    if (currentSession === did) setAgent(undefined);
  };

  return (
    <MenuProvider>
      <DropdownMenu icon="lucide--ellipsis" buttonClass="rounded-md p-2">
        <NavMenu
          href={`/at://${props.did}`}
          label="Go to repo"
          icon="lucide--user-round"
          shortcut={agent()?.sub === props.did ? "G" : undefined}
        />
        <ActionMenu
          icon="lucide--settings"
          label="Edit permissions"
          onClick={() => props.onEditPermissions(props.did)}
        />
        <ActionMenu
          icon="lucide--x"
          label="Remove account"
          onClick={() => removeSession(props.did)}
        />
      </DropdownMenu>
    </MenuProvider>
  );
};

export const AccountManager = () => {
  const getThumbnailUrl = (avatarUrl: string) => {
    return avatarUrl.replace("img/avatar/", "img/avatar_thumbnail/");
  };

  const scopeFlow = useOAuthScopeFlow({
    beforeRedirect: (account) => resumeSession(account as Did),
  });

  createEffect(() => {
    const pending = pendingPermissionEdit();
    if (pending) {
      scopeFlow.initiateWithRedirect(pending);
      setPendingPermissionEdit(null);
    }
  });

  const handleAccountClick = async (did: Did) => {
    try {
      await resumeSession(did);
    } catch {
      scopeFlow.initiate(did);
    }
  };

  onMount(async () => {
    try {
      await retrieveSession();
    } catch {}

    const storedSessions = loadSessionsFromStorage();
    if (storedSessions) {
      const sessionDids = Object.keys(storedSessions) as Did[];
      sessionDids.forEach(async (did) => {
        await loadHandleForSession(did, storedSessions);
      });
      sessionDids.forEach(async (did) => {
        const avatar = await getAvatar(did);
        if (avatar) setAvatars(did, avatar);
      });
    }
  });

  return (
    <>
      <Modal
        open={openManager()}
        onClose={() => {
          setOpenManager(false);
          setShowAddAccount(false);
          scopeFlow.cancel();
        }}
        alignTop
        contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto w-full max-w-sm rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 mx-3 shadow-md dark:border-neutral-700"
      >
        <Show when={!scopeFlow.showScopeSelector() && !showAddAccount()}>
          <div class="mb-2 px-1 font-semibold">
            <span>Switch account</span>
          </div>
          <div class="mb-3 max-h-80 overflow-y-auto md:max-h-100">
            <For each={Object.keys(sessions)}>
              {(did) => (
                <div class="flex w-full items-center justify-between">
                  <A
                    href={`/at://${did}`}
                    onClick={() => setOpenManager(false)}
                    class="flex shrink-0 items-center rounded-md p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  >
                    <Show
                      when={avatars[did as Did]}
                      fallback={<span class="iconify lucide--user-round m-0.5 size-5"></span>}
                    >
                      <img src={getThumbnailUrl(avatars[did as Did])} class="size-6 rounded-full" />
                    </Show>
                  </A>
                  <button
                    class="flex grow items-center justify-between gap-1 truncate rounded-md p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    onclick={() => handleAccountClick(did as Did)}
                  >
                    <span class="truncate">{sessions[did]?.handle || did}</span>
                    <Show when={did === agent()?.sub && sessions[did].signedIn}>
                      <span class="iconify lucide--circle-check shrink-0 text-blue-500 dark:text-blue-400"></span>
                    </Show>
                    <Show when={!sessions[did].signedIn}>
                      <span class="iconify lucide--circle-alert shrink-0 text-red-500 dark:text-red-400"></span>
                    </Show>
                  </button>
                  <AccountDropdown
                    did={did as Did}
                    onEditPermissions={(accountDid) => scopeFlow.initiateWithRedirect(accountDid)}
                  />
                </div>
              )}
            </For>
          </div>
          <button
            onclick={() => setShowAddAccount(true)}
            class="dark:hover:bg-dark-200 dark:active:bg-dark-100 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700"
          >
            <span class="iconify lucide--plus"></span>
            <span>Add account</span>
          </button>
        </Show>

        <Show when={showAddAccount() && !scopeFlow.showScopeSelector()}>
          <Login onCancel={() => setShowAddAccount(false)} />
        </Show>

        <Show when={scopeFlow.showScopeSelector()}>
          <ScopeSelector
            initialScopes={parseScopeString(
              sessions[scopeFlow.pendingAccount()]?.grantedScopes || "",
            )}
            onConfirm={scopeFlow.complete}
            onCancel={() => {
              scopeFlow.cancel();
              setShowAddAccount(false);
            }}
          />
        </Show>
      </Modal>
      <button
        onclick={() => setOpenManager(true)}
        class={`flex items-center rounded-md ${agent() && avatars[agent()!.sub] ? "p-1.25" : "p-1.5"} hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600`}
      >
        {agent() && avatars[agent()!.sub] ?
          <img src={getThumbnailUrl(avatars[agent()!.sub])} class="size-5 rounded-full" />
        : <span class="iconify lucide--circle-user-round text-lg"></span>}
      </button>
    </>
  );
};
