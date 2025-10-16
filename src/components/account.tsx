import { Client, CredentialManager } from "@atcute/client";
import { Did } from "@atcute/lexicons";
import {
  createAuthorizationUrl,
  deleteStoredSession,
  getSession,
  OAuthUserAgent,
  resolveFromIdentity,
} from "@atcute/oauth-browser-client";
import { A } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { resolveDidDoc } from "../utils/api.js";
import { agent, Login, retrieveSession, Sessions, setAgent } from "./login.jsx";
import { Modal } from "./modal.jsx";

const AccountManager = () => {
  const [openManager, setOpenManager] = createSignal(false);
  const [sessions, setSessions] = createStore<Sessions>();
  const [avatars, setAvatars] = createStore<Record<Did, string>>();

  onMount(async () => {
    try {
      await retrieveSession();
    } catch {}

    const localSessions = localStorage.getItem("sessions");
    if (localSessions) {
      const storedSessions: Sessions = JSON.parse(localSessions);
      const sessionDids = Object.keys(storedSessions) as Did[];
      sessionDids.forEach(async (did) => {
        const doc = await resolveDidDoc(did);
        doc.alsoKnownAs?.forEach((alias) => {
          if (alias.startsWith("at://")) {
            setSessions(did, {
              signedIn: storedSessions[did].signedIn,
              handle: alias.replace("at://", ""),
            });
            return;
          }
        });
      });
      sessionDids.forEach(async (did) => {
        const avatar = await getAvatar(did);
        if (avatar) setAvatars(did, avatar);
      });
    }
  });

  const resumeSession = async (did: Did) => {
    try {
      localStorage.setItem("lastSignedIn", did);
      await retrieveSession();
    } catch {
      const resolved = await resolveFromIdentity(did);
      const authUrl = await createAuthorizationUrl({
        scope: import.meta.env.VITE_OAUTH_SCOPE,
        ...resolved,
      });

      await new Promise((resolve) => setTimeout(resolve, 250));

      location.assign(authUrl);
    }
  };

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
    localStorage.setItem("sessions", JSON.stringify(sessions));
    if (currentSession === did) setAgent(undefined);
  };

  const getAvatar = async (did: Did) => {
    const rpc = new Client({
      handler: new CredentialManager({ service: "https://public.api.bsky.app" }),
    });
    const res = await rpc.get("app.bsky.actor.getProfile", { params: { actor: did } });
    if (res.ok) {
      return res.data.avatar;
    }
    return undefined;
  };

  return (
    <>
      <Modal open={openManager()} onClose={() => setOpenManager(false)}>
        <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute top-16 left-[50%] w-[22rem] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 dark:border-neutral-700 starting:opacity-0">
          <div class="mb-2 px-1 font-semibold">
            <span>Manage accounts</span>
          </div>
          <div class="mb-3 max-h-[20rem] overflow-y-auto md:max-h-[25rem]">
            <For each={Object.keys(sessions)}>
              {(did) => (
                <div class="flex items-center">
                  <button
                    class="flex w-full items-center justify-between gap-1 truncate rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    onclick={() => resumeSession(did as Did)}
                  >
                    <span class="flex items-center gap-2 truncate">
                      <Show when={avatars[did as Did]}>
                        <img
                          src={avatars[did as Did].replace("img/avatar/", "img/avatar_thumbnail/")}
                          class="size-6 rounded-full"
                        />
                      </Show>
                      <span class="truncate">
                        {sessions[did]?.handle ? sessions[did].handle : did}
                      </span>
                    </span>
                    <Show when={did === agent()?.sub && sessions[did].signedIn}>
                      <span class="iconify lucide--check shrink-0 text-green-500 dark:text-green-400"></span>
                    </Show>
                    <Show when={!sessions[did].signedIn}>
                      <span class="iconify lucide--circle-alert shrink-0 text-red-500 dark:text-red-400"></span>
                    </Show>
                  </button>
                  <A
                    href={`/at://${did}`}
                    onClick={() => setOpenManager(false)}
                    class="flex items-center rounded-lg p-2 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  >
                    <span class="iconify lucide--user-round"></span>
                  </A>
                  <button
                    onclick={() => removeSession(did as Did)}
                    class="flex items-center rounded-lg p-2 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  >
                    <span class="iconify lucide--x"></span>
                  </button>
                </div>
              )}
            </For>
          </div>
          <Login />
        </div>
      </Modal>
      <button
        onclick={() => setOpenManager(true)}
        class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
      >
        {agent() && avatars[agent()!.sub] ?
          <img
            src={avatars[agent()!.sub].replace("img/avatar/", "img/avatar_thumbnail/")}
            class="size-5 rounded-full"
          />
        : <span class="iconify lucide--circle-user-round text-xl"></span>}
      </button>
    </>
  );
};

export { AccountManager };
