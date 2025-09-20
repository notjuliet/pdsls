import { Client, CredentialManager } from "@atcute/client";
import { Did } from "@atcute/lexicons";
import { deleteStoredSession, getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { createSignal, For, onMount, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { resolveDidDoc } from "../utils/api.js";
import { agent, Login, retrieveSession, setAgent } from "./login.jsx";
import { Modal } from "./modal.jsx";

const AccountManager = () => {
  const [openManager, setOpenManager] = createSignal(false);
  const [sessions, setSessions] = createStore<Record<string, string | undefined>>();
  const [avatar, setAvatar] = createSignal<string>();

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
    }

    const repo = localStorage.getItem("lastSignedIn");
    if (repo) setAvatar(await getAvatar(repo as Did));
  });

  const resumeSession = async (did: Did) => {
    localStorage.setItem("lastSignedIn", did);
    retrieveSession();
    setAvatar(await getAvatar(did));
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
        <div class="dark:bg-dark-300 dark:shadow-dark-800 absolute top-12 left-[50%] w-[22rem] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-300 sm:w-[24rem] dark:border-neutral-700 starting:opacity-0">
          <div class="mb-2 flex items-center gap-1 font-semibold">
            <span class="iconify lucide--user-round"></span>
            <span>Manage accounts</span>
          </div>
          <div class="mb-3 max-h-[20rem] overflow-y-auto md:max-h-[25rem]">
            <For each={Object.keys(sessions)}>
              {(did) => (
                <div class="flex items-center gap-1">
                  <div class="flex w-full items-center justify-between gap-x-2 rounded-lg hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600">
                    <button
                      class="flex basis-full items-center justify-between gap-1 truncate p-1"
                      onclick={() => resumeSession(did as Did)}
                    >
                      <span class="truncate">{sessions[did]?.length ? sessions[did] : did}</span>
                      <Show when={did === agent()?.sub}>
                        <span class="iconify lucide--check shrink-0"></span>
                      </Show>
                    </button>
                  </div>
                  <button
                    onclick={() => removeSession(did as Did)}
                    class="flex items-center p-1 hover:text-red-500 hover:dark:text-red-400"
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
        {agent() && avatar() ?
          <img src={avatar()} class="dark:shadow-dark-800 size-5 rounded-full shadow-xs" />
        : <span class="iconify lucide--circle-user-round text-xl"></span>}
      </button>
    </>
  );
};

export { AccountManager };
