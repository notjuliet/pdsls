import { createSignal, onMount, Show, onCleanup, createEffect, For } from "solid-js";
import Tooltip from "./tooltip.jsx";
import { deleteStoredSession, getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { agent, Login, setLoginState } from "./login.jsx";
import { At } from "@atcute/client/lexicons";

const AccountManager = () => {
  const [modal, setModal] = createSignal<HTMLDialogElement>();
  const [openManager, setOpenManager] = createSignal(false);
  const [sessions, setSessions] = createSignal<At.Did[]>([]);

  const clickEvent = (event: MouseEvent) => {
    if (modal() && event.target == modal()) setOpenManager(false);
  };
  const keyEvent = (event: KeyboardEvent) => {
    if (modal() && event.key == "Escape") setOpenManager(false);
  };

  onMount(() => {
    window.addEventListener("keydown", keyEvent);
    window.addEventListener("click", clickEvent);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", keyEvent);
    window.removeEventListener("click", clickEvent);
  });

  createEffect(() => {
    if (openManager()) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
  });

  createEffect(() => {
    if (openManager()) {
      const storedSessions = localStorage.getItem("atcute-oauth:sessions");
      if (storedSessions) {
        setSessions(Object.keys(JSON.parse(storedSessions)) as At.Did[]);
      }
    }
  });

  const resumeSession = (did: `did:${string}`) => {
    localStorage.setItem("lastSignedIn", did);
    window.location.href = "/";
  };

  const removeSession = async (did: At.Did) => {
    const currentSession = agent?.sub;
    try {
      const session = await getSession(did, { allowStale: true });
      const agent = new OAuthUserAgent(session);
      await agent.signOut();
    } catch {
      deleteStoredSession(did);
    }
    setSessions(sessions().filter((session) => session !== did));
    if (currentSession === did) {
      setLoginState(false);
      window.location.reload;
    }
  };

  return (
    <>
      <Show when={openManager()}>
        <dialog
          ref={setModal}
          class="backdrop-brightness-60 fixed left-0 top-0 z-20 flex h-screen w-screen items-center justify-center bg-transparent"
        >
          <div class="dark:bg-dark-400 top-10% absolute rounded-md border border-slate-900 bg-slate-100 p-4 text-slate-900 dark:border-slate-100 dark:text-slate-100">
            <h3 class="mb-2 font-bold">Manage accounts</h3>
            <div class="mb-2 max-h-[20rem] overflow-y-auto border-b border-neutral-500 pb-2 md:max-h-[25rem]">
              <For each={sessions()}>
                {(session) => (
                  <div class="group/select flex w-full items-center justify-between gap-x-2">
                    <button
                      classList={{
                        "bg-transparent basis-full text-left font-mono max-w-[32ch] text-sm truncate group-hover/select:bg-slate-300 dark:group-hover/select:bg-neutral-700":
                          true,
                        "text-green-500 dark:text-green-400": session === agent?.sub,
                      }}
                      onclick={() => resumeSession(session)}
                    >
                      {session}
                    </button>
                    <button
                      class="i-lucide-x text-xl text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-500"
                      onclick={() => removeSession(session)}
                    />
                  </div>
                )}
              </For>
            </div>
            <Login />
          </div>
        </dialog>
      </Show>
      <Tooltip
        text="Manage accounts"
        children={
          <button
            class="i-lucide-user cursor-pointer text-xl"
            onclick={() => setOpenManager(true)}
          />
        }
      />
    </>
  );
};

export { AccountManager };
