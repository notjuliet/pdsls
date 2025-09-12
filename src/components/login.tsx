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
import { createSignal } from "solid-js";
import { TextInput } from "./text-input";

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
    <form class="flex flex-col gap-y-2" onsubmit={(e) => e.preventDefault()}>
      <div class="flex items-center gap-1">
        <label for="handle" class="mr-1 flex items-center">
          <span class="iconify lucide--user-round-plus text-lg"></span>
        </label>
        <TextInput
          id="handle"
          placeholder="user.bsky.social"
          onInput={(e) => setLoginInput(e.currentTarget.value)}
          class="grow"
        />
        <button
          onclick={() => login(loginInput())}
          class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          <span class="iconify lucide--log-in text-lg"></span>
        </button>
      </div>
      <div>{notice()}</div>
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
