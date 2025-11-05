import { Client } from "@atcute/client";
import { Did } from "@atcute/lexicons";
import { isDid, isHandle } from "@atcute/lexicons/syntax";
import {
  configureOAuth,
  createAuthorizationUrl,
  defaultIdentityResolver,
  finalizeAuthorization,
  getSession,
  OAuthUserAgent,
  type Session,
} from "@atcute/oauth-browser-client";
import { createSignal, Show } from "solid-js";
import { didDocumentResolver, handleResolver } from "../utils/api";

configureOAuth({
  metadata: {
    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URL,
  },
  identityResolver: defaultIdentityResolver({
    handleResolver: handleResolver,
    didDocumentResolver: didDocumentResolver,
  }),
});

export const [agent, setAgent] = createSignal<OAuthUserAgent | undefined>();

type Account = {
  signedIn: boolean;
  handle?: string;
};

export type Sessions = Record<string, Account>;

const Login = () => {
  const [notice, setNotice] = createSignal("");
  const [loginInput, setLoginInput] = createSignal("");

  const login = async (handle: string) => {
    try {
      setNotice("");
      if (!handle) return;
      setNotice(`Contacting your data server...`);
      const authUrl = await createAuthorizationUrl({
        scope: import.meta.env.VITE_OAUTH_SCOPE,
        target:
          isHandle(handle) || isDid(handle) ?
            { type: "account", identifier: handle }
          : { type: "pds", serviceUrl: handle },
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
      <label for="username" class="hidden">
        Add account
      </label>
      <div class="dark:bg-dark-100 dark:shadow-dark-700 flex grow items-center gap-2 rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 shadow-xs focus-within:outline-[1px] focus-within:outline-neutral-600 dark:border-neutral-600 dark:focus-within:outline-neutral-400">
        <label
          for="username"
          class="iconify lucide--user-round-plus shrink-0 text-neutral-500 dark:text-neutral-400"
        ></label>
        <input
          type="text"
          spellcheck={false}
          placeholder="user.bsky.social"
          id="username"
          name="username"
          autocomplete="username"
          class="grow py-1 select-none placeholder:text-sm focus:outline-none"
          onInput={(e) => setLoginInput(e.currentTarget.value)}
        />
        <button
          onclick={() => login(loginInput())}
          class="flex items-center rounded-lg p-1 hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-600 dark:active:bg-neutral-500"
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

      const auth = await finalizeAuthorization(params);
      const did = auth.session.info.sub;

      localStorage.setItem("lastSignedIn", did);

      const sessions = localStorage.getItem("sessions");
      const newSessions: Sessions = sessions ? JSON.parse(sessions) : { [did]: {} };
      newSessions[did] = { signedIn: true };
      localStorage.setItem("sessions", JSON.stringify(newSessions));
      return auth.session;
    } else {
      const lastSignedIn = localStorage.getItem("lastSignedIn");

      if (lastSignedIn) {
        const sessions = localStorage.getItem("sessions");
        const newSessions: Sessions = sessions ? JSON.parse(sessions) : {};
        try {
          const session = await getSession(lastSignedIn as Did);
          const rpc = new Client({ handler: new OAuthUserAgent(session) });
          const res = await rpc.get("com.atproto.server.getSession");
          newSessions[lastSignedIn].signedIn = true;
          localStorage.setItem("sessions", JSON.stringify(newSessions));
          if (!res.ok) throw res.data.error;
          return session;
        } catch (err) {
          newSessions[lastSignedIn].signedIn = false;
          localStorage.setItem("sessions", JSON.stringify(newSessions));
          throw err;
        }
      }
    }
  };

  const session = await init();

  if (session) setAgent(new OAuthUserAgent(session));
};

export { Login, retrieveSession };
