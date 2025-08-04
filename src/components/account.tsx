import { createSignal, onMount, For, Show } from "solid-js";
import Tooltip from "./tooltip.jsx";
import { deleteStoredSession, getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { agent, Login, loginState, retrieveSession, setLoginState } from "./login.jsx";
import { Did } from "@atcute/lexicons";
import { resolveDidDoc } from "../utils/api.js";
import { createStore } from "solid-js/store";
import { Client, CredentialManager } from "@atcute/client";
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

  const resumeSession = (did: Did) => {
    localStorage.setItem("lastSignedIn", did);
    window.location.href = "/";
  };

  const removeSession = async (did: Did) => {
    const currentSession = agent?.sub;
    try {
      const session = await getSession(did, { allowStale: true });
      const agent = new OAuthUserAgent(session);
      await agent.signOut();
    } catch {
      deleteStoredSession(did);
    }
    setSessions(did, undefined);
    if (currentSession === did) setLoginState(false);
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
        <div class="starting:opacity-0 dark:bg-dark-800/70 border-0.5 w-21rem dark:shadow-dark-900/80 backdrop-blur-xs left-50% absolute top-12 -translate-x-1/2 rounded-md border-neutral-300 bg-zinc-200/70 p-4 text-slate-900 shadow-md transition-opacity duration-300 dark:border-neutral-700 dark:text-slate-100">
          <h3 class="mb-2 font-bold">Manage accounts</h3>
          <div class="mb-3 max-h-[20rem] overflow-y-auto md:max-h-[25rem]">
            <For each={Object.keys(sessions)}>
              {(did) => (
                <div class="group/select flex w-full items-center justify-between gap-x-2">
                  <button
                    class="flex basis-full items-center justify-between gap-1 truncate rounded bg-transparent px-1 text-left group-hover/select:bg-zinc-100 dark:group-hover/select:bg-neutral-600"
                    onclick={() => resumeSession(did as Did)}
                  >
                    <span class="truncate">{sessions[did]?.length ? sessions[did] : did}</span>
                    <Show when={did === agent?.sub}>
                      <div class="i-lucide-check shrink-0" />
                    </Show>
                  </button>
                  <button onclick={() => removeSession(did as Did)}>
                    <div class="i-lucide-x text-lg hover:text-red-500 hover:dark:text-red-400" />
                  </button>
                </div>
              )}
            </For>
          </div>
          <Login />
        </div>
      </Modal>
      <button onclick={() => setOpenManager(true)}>
        <Tooltip text="Accounts">
          {loginState() && avatar() ?
            <img src={avatar()} class="dark:shadow-dark-900/80 size-5 rounded-full shadow-sm" />
          : <div class="i-lucide-circle-user-round text-xl" />}
        </Tooltip>
      </button>
    </>
  );
};

export { AccountManager };
