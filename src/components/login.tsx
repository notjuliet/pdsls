import { Did } from "@atcute/lexicons";
import { isHandle } from "@atcute/lexicons/syntax";
import {
  configureOAuth,
  createAuthorizationUrl,
  deleteStoredSession,
  finalizeAuthorization,
  getSession,
  OAuthUserAgent,
  resolveFromIdentity,
  resolveFromService,
  type Session,
} from "@atcute/oauth-browser-client";
import { createSignal, Show } from "solid-js";

configureOAuth({
  metadata: {
    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URL,
  },
});

export const [agent, setAgent] = createSignal<OAuthUserAgent | undefined>();

const Login = () => {
  const [notice, setNotice] = createSignal("");
  const [loginInput, setLoginInput] = createSignal("");

  const login = async (handle: string) => {
    try {
      setNotice("");
      if (!handle) return;
      let resolved;
      if (!isHandle(handle)) {
        setNotice(`Resolving your service...`);
        resolved = await resolveFromService(handle);
      } else {
        setNotice(`Resolving your identity...`);
        resolved = await resolveFromIdentity(handle);
      }

      setNotice(`Contacting your data server...`);
      const authUrl = await createAuthorizationUrl({
        scope: import.meta.env.VITE_OAUTH_SCOPE,
        ...resolved,
      });

      setNotice(`Redirecting...`);
      await new Promise((resolve) => setTimeout(resolve, 250));

      location.assign(authUrl);
    } catch (e) {
      console.error(e);
      setNotice(`${e}`);
    }
  };

  return (
    <form class="flex flex-col gap-y-2 px-1" onsubmit={(e) => e.preventDefault()}>
      <div class="flex items-center gap-1">
        <label for="handle" class="hidden">
          Add account
        </label>
        <div class="dark:bg-dark-100 dark:shadow-dark-700 flex grow items-center gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 shadow-xs focus-within:outline-[1px] focus-within:outline-neutral-600 dark:border-neutral-600 dark:focus-within:outline-neutral-400">
          <label
            for="handle"
            class="iconify lucide--user-round-plus text-neutral-500 dark:text-neutral-400"
          ></label>
          <input
            type="text"
            spellcheck={false}
            placeholder="user.bsky.social"
            id="handle"
            class="grow py-1 select-none placeholder:text-sm focus:outline-none"
            onInput={(e) => setLoginInput(e.currentTarget.value)}
          />
        </div>
        <button
          onclick={() => login(loginInput())}
          class="flex items-center rounded-lg p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          <span class="iconify lucide--log-in"></span>
        </button>
      </div>
      <Show when={notice()}>
        <div class="text-sm">{notice()}</div>
      </Show>
    </form>
  );
};

const retrieveSession = async () => {
  const init = async (): Promise<Session | undefined> => {
    const params = new URLSearchParams(location.hash.slice(1));

    if (params.has("state") && (params.has("code") || params.has("error"))) {
      history.replaceState(null, "", location.pathname + location.search);

      const session = await finalizeAuthorization(params);
      const did = session.info.sub;

      localStorage.setItem("lastSignedIn", did);
      return session;
    } else {
      const lastSignedIn = localStorage.getItem("lastSignedIn");

      if (lastSignedIn) {
        try {
          return await getSession(lastSignedIn as Did);
        } catch (err) {
          deleteStoredSession(lastSignedIn as Did);
          localStorage.removeItem("lastSignedIn");
          throw err;
        }
      }
    }
  };

  const session = await init().catch(() => {});

  if (session) setAgent(new OAuthUserAgent(session));
};

export { Login, retrieveSession };
