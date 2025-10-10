import { Client, CredentialManager } from "@atcute/client";
import { Did } from "@atcute/lexicons";
import { deleteStoredSession, getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { A } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { resolveDidDoc } from "../utils/api.js";
import { agent, Login, retrieveSession, setAgent } from "./login.jsx";
import { Modal } from "./modal.jsx";

const AccountManager = () => {
  const [openManager, setOpenManager] = createSignal(false);
  const [sessions, setSessions] = createStore<Record<string, string | undefined>>();
  const [avatars, setAvatars] = createStore<Record<Did, string>>();

  onMount(async () => {
    await retrieveSession();

    const storedSessions = localStorage.getItem("atcute-oauth:sessions");
    if (storedSessions) {
      const sessionDids = Object.keys(JSON.parse(storedSessions)) as Did[];
      sessionDids.forEach((did) => setSessions(did, ""));
      sessionDids.forEach(async (did) => {
        const doc = await resolveDidDoc(did);
        doc.alsoKnownAs?.forEach((alias) => {
          if (alias.startsWith("at://")) {
            setSessions(did, alias.replace("at://", ""));
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
    localStorage.setItem("lastSignedIn", did);
    retrieveSession();
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
    setSessions(did, undefined);
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
        <div class="dark:bg-dark-300 dark:shadow-dark-800 absolute top-16 left-[50%] w-[22rem] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 dark:border-neutral-700 starting:opacity-0">
          <div class="mb-2 flex items-center gap-1 px-1 font-semibold">
            <span class="iconify lucide--user-round"></span>
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
                    <span class="flex items-center gap-2">
                      <Show when={avatars[did as Did]}>
                        <img
                          src={avatars[did as Did].replace("img/avatar/", "img/avatar_thumbnail/")}
                          class="size-6 rounded-full"
                        />
                      </Show>
                      <span class="truncate">{sessions[did]?.length ? sessions[did] : did}</span>
                    </span>
                    <Show when={did === agent()?.sub}>
                      <span class="iconify lucide--check shrink-0 text-green-500 dark:text-green-400"></span>
                    </Show>
                  </button>
                  <A
                    href={`/at://${did}`}
                    onClick={() => setOpenManager(false)}
                    class="flex items-center rounded-lg p-2 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  >
                    <span class="iconify lucide--book-user"></span>
                  </A>
                  <button
                    onclick={() => removeSession(did as Did)}
                    class="flex items-center rounded-lg p-2 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  >
                    <span class="iconify lucide--user-round-x"></span>
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
