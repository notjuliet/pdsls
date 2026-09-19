import { Did } from "@atcute/lexicons";
import { deleteStoredSession, getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { useNavigate } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import { produce } from "solid-js/store";

import {
  ActionMenu,
  DropdownMenu,
  MenuProvider,
  MenuSeparator,
  NavMenu,
} from "../components/dropdown.jsx";
import { clearSpaceCredentials } from "../lib/spaces.js";
import {
  getAvatar,
  loadHandleForSession,
  loadSessionsFromStorage,
  resumeSession,
  retrieveSession,
  saveSessionToStorage,
} from "./session-manager.js";
import { agent, avatars, sessions, setAgent, setAvatars, setSessions } from "./state.js";

const getThumbnailUrl = (avatarUrl: string) =>
  avatarUrl.replace("img/avatar/", "img/avatar_thumbnail/");

export const AccountManager = (props: { onCreateRecord?: () => void }) => {
  const navigate = useNavigate();
  const [switchingAccount, setSwitchingAccount] = createSignal<Did>();
  const [removingAccount, setRemovingAccount] = createSignal<Did>();

  const otherSessions = () =>
    (Object.keys(sessions) as Did[]).filter((did) => did !== agent()?.sub);

  const removeSession = async (did: Did) => {
    if (removingAccount()) return;
    setRemovingAccount(did);
    const currentSession = agent()?.sub;
    try {
      try {
        const session = await getSession(did, { allowStale: true });
        const sessionAgent = new OAuthUserAgent(session);
        await sessionAgent.signOut();
      } catch {
        deleteStoredSession(did);
      }
      setSessions(
        produce((accounts) => {
          delete accounts[did];
        }),
      );
      saveSessionToStorage(sessions);
      clearSpaceCredentials(did);
      if (currentSession === did) setAgent(undefined);
    } finally {
      setRemovingAccount();
    }
  };

  const handleAccountClick = async (did: Did) => {
    if (switchingAccount()) return;
    setSwitchingAccount(did);
    try {
      await resumeSession(did);
    } catch {
      navigate(`/account/${did}/permissions`);
    } finally {
      setSwitchingAccount();
    }
  };

  const openAddAccount = () => navigate("/account/add");
  const openPermissions = (did: Did) => navigate(`/account/${did}/permissions`);

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
    <MenuProvider>
      <DropdownMenu
        buttonLabel="Account"
        buttonClass="size-9 justify-center rounded-md"
        buttonContent={
          agent() && avatars[agent()!.sub] ? (
            <img src={getThumbnailUrl(avatars[agent()!.sub])} class="size-6 rounded-full" />
          ) : (
            <span class="iconify lucide--circle-user-round text-xl" />
          )
        }
        menuWidth={304}
        menuClass="p-3 text-base"
      >
        <Show
          when={agent()}
          fallback={
            <div class="px-1.5 py-1">
              <div class="font-medium">Account</div>
              <div class="text-xs text-neutral-500 dark:text-neutral-400">Not signed in</div>
            </div>
          }
        >
          {(currentAgent) => (
            <NavMenu href={`/at://${currentAgent().sub}`} label="Open current repository">
              <div class="flex min-w-0 items-center gap-2">
                <Show
                  when={avatars[currentAgent().sub]}
                  fallback={<span class="iconify lucide--user-round size-8 shrink-0" />}
                >
                  <img
                    src={getThumbnailUrl(avatars[currentAgent().sub])}
                    class="size-8 shrink-0 rounded-full"
                  />
                </Show>
                <div class="flex min-w-0 flex-col">
                  <span class="truncate font-medium">
                    {sessions[currentAgent().sub]?.handle ?? currentAgent().sub}
                  </span>
                  <span class="truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {currentAgent().sub}
                  </span>
                </div>
              </div>
            </NavMenu>
          )}
        </Show>
        <Show when={agent()}>
          {(currentAgent) => (
            <>
              <ActionMenu
                icon="lucide--square-pen size-4"
                label="Create record"
                onClick={() => props.onCreateRecord?.()}
              />
              <NavMenu href="/spaces" label="Spaces" icon="lucide--lock-keyhole size-4" />
              <ActionMenu
                icon="lucide--key-round size-4"
                label="Edit permissions"
                onClick={() => openPermissions(currentAgent().sub)}
              />
              <ActionMenu
                icon="lucide--log-out size-4"
                label="Sign out"
                onClick={() => void removeSession(currentAgent().sub)}
              />
            </>
          )}
        </Show>

        <MenuSeparator />
        <Show when={otherSessions().length > 0}>
          <div class="max-h-48 overflow-y-auto">
            <For each={otherSessions()}>
              {(did) => {
                const label = () => sessions[did]?.handle ?? did;

                return (
                  <div class="flex w-full items-center gap-1">
                    <div class="min-w-0 flex-1">
                      <ActionMenu
                        label={label()}
                        icon={
                          avatars[did] ? (
                            <img src={getThumbnailUrl(avatars[did])} class="size-4 rounded-full" />
                          ) : (
                            <span class="iconify lucide--user-round size-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
                          )
                        }
                        trailing={
                          <Show
                            when={switchingAccount() === did}
                            fallback={
                              <Show when={!sessions[did]?.signedIn}>
                                <span class="iconify lucide--circle-alert shrink-0 text-red-500 dark:text-red-400" />
                              </Show>
                            }
                          >
                            <span class="iconify lucide--loader-circle shrink-0 animate-spin text-neutral-500 dark:text-neutral-400" />
                          </Show>
                        }
                        onClick={() => handleAccountClick(did)}
                      />
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${label()}`}
                      title="Remove account"
                      disabled={removingAccount() === did}
                      onclick={(event) => {
                        event.stopPropagation();
                        void removeSession(did);
                      }}
                      class="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-600 active:bg-red-100 disabled:cursor-wait dark:text-neutral-500 dark:hover:bg-red-500/15 dark:hover:text-red-300 dark:active:bg-red-500/25"
                    >
                      <Show
                        when={removingAccount() === did}
                        fallback={<span class="iconify lucide--x size-4" />}
                      >
                        <span class="iconify lucide--loader-circle size-4 animate-spin" />
                      </Show>
                    </button>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
        <ActionMenu
          icon="lucide--user-round-plus size-4"
          label="Add account"
          onClick={openAddAccount}
        />

        <MenuSeparator />
        <NavMenu href="/settings" label="Settings" icon="lucide--settings size-4" />
      </DropdownMenu>
    </MenuProvider>
  );
};
