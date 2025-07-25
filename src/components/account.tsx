import { createSignal, onMount, Show, onCleanup, createEffect, For } from "solid-js";
import Tooltip from "./tooltip.jsx";
import { deleteStoredSession, getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { agent, Login, loginState, setLoginState } from "./login.jsx";
import { Did } from "@atcute/lexicons";
import { resolveDidDoc } from "../utils/api.js";
import { createStore } from "solid-js/store";
import { Client, CredentialManager } from "@atcute/client";

const AccountManager = () => {
  const [modal, setModal] = createSignal<HTMLDialogElement>();
  const [openManager, setOpenManager] = createSignal(false);
  const [sessions, setSessions] = createStore<Record<string, string | undefined>>();
  const [avatar, setAvatar] = createSignal<string>();

  const clickEvent = (event: MouseEvent) => {
    if (modal() && event.target == modal()) setOpenManager(false);
  };
  const keyEvent = (event: KeyboardEvent) => {
    if (modal() && event.key == "Escape") setOpenManager(false);
  };

  onMount(async () => {
    window.addEventListener("keydown", keyEvent);
    window.addEventListener("click", clickEvent);

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

  onCleanup(() => {
    window.removeEventListener("keydown", keyEvent);
    window.removeEventListener("click", clickEvent);
  });

  createEffect(() => {
    if (openManager()) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
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
    if (currentSession === did) {
      setLoginState(false);
      window.location.reload;
    }
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
      <Show when={openManager()}>
        <dialog
          ref={setModal}
          class="starting:backdrop-brightness-100 fixed left-0 top-0 z-20 flex h-screen w-screen items-center justify-center bg-transparent backdrop-brightness-50 transition duration-300"
        >
          <div class="starting:opacity-0 dark:bg-dark-300 absolute top-12 rounded-md bg-zinc-100 p-4 text-slate-900 transition-opacity duration-300 dark:text-slate-100">
            <h3 class="mb-2 font-bold">Manage accounts</h3>
            <div class="mb-2 max-h-[20rem] overflow-y-auto border-b border-neutral-500 pb-2 md:max-h-[25rem]">
              <For each={Object.keys(sessions)}>
                {(did) => (
                  <div class="group/select flex w-full items-center justify-between gap-x-2">
                    <button
                      classList={{
                        "bg-transparent basis-full text-left max-w-[32ch] truncate group-hover/select:bg-zinc-200 px-1 rounded dark:group-hover/select:bg-neutral-600": true,
                        "text-blue-500 dark:text-blue-400 font-bold": did === agent?.sub,
                      }}
                      onclick={() => resumeSession(did as Did)}
                    >
                      {sessions[did]?.length ? sessions[did] : did}
                    </button>
                    <button onclick={() => removeSession(did as Did)}>
                      <div class="i-lucide-x text-xl text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-500" />
                    </button>
                  </div>
                )}
              </For>
            </div>
            <Login />
          </div>
        </dialog>
      </Show>
      <button onclick={() => setOpenManager(true)}>
        <Tooltip text="Accounts">
          {loginState() && avatar() ?
            <img src={avatar()} class="size-5 rounded-full" />
          : <div class="i-lucide-circle-user-round text-xl" />}
        </Tooltip>
      </button>
    </>
  );
};

export { AccountManager };
