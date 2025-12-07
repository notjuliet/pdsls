import { Client, simpleFetchHandler } from "@atcute/client";
import { Did } from "@atcute/lexicons";
import {
  finalizeAuthorization,
  getSession,
  OAuthUserAgent,
  type Session,
} from "@atcute/oauth-browser-client";
import { resolveDidDoc } from "../utils/api";
import { Sessions, setAgent, setSessions } from "./state";

export const saveSessionToStorage = (sessions: Sessions) => {
  localStorage.setItem("sessions", JSON.stringify(sessions));
};

export const loadSessionsFromStorage = (): Sessions | null => {
  const localSessions = localStorage.getItem("sessions");
  return localSessions ? JSON.parse(localSessions) : null;
};

export const getAvatar = async (did: Did): Promise<string | undefined> => {
  const rpc = new Client({
    handler: simpleFetchHandler({ service: "https://public.api.bsky.app" }),
  });
  const res = await rpc.get("app.bsky.actor.getProfile", { params: { actor: did } });
  if (res.ok) {
    return res.data.avatar;
  }
  return undefined;
};

export const loadHandleForSession = async (did: Did, storedSessions: Sessions) => {
  const doc = await resolveDidDoc(did);
  const alias = doc.alsoKnownAs?.find((alias) => alias.startsWith("at://"));
  if (alias) {
    setSessions(did, {
      signedIn: storedSessions[did].signedIn,
      handle: alias.replace("at://", ""),
      grantedScopes: storedSessions[did].grantedScopes,
    });
  }
};

export const retrieveSession = async (): Promise<void> => {
  const init = async (): Promise<Session | undefined> => {
    const params = new URLSearchParams(location.hash.slice(1));

    if (params.has("state") && (params.has("code") || params.has("error"))) {
      history.replaceState(null, "", location.pathname + location.search);

      const auth = await finalizeAuthorization(params);
      const did = auth.session.info.sub;

      localStorage.setItem("lastSignedIn", did);

      const grantedScopes = localStorage.getItem("pendingScopes") || "atproto";
      localStorage.removeItem("pendingScopes");

      const sessions = loadSessionsFromStorage();
      const newSessions: Sessions = sessions || {};
      newSessions[did] = { signedIn: true, grantedScopes };
      saveSessionToStorage(newSessions);
      return auth.session;
    } else {
      const lastSignedIn = localStorage.getItem("lastSignedIn");

      if (lastSignedIn) {
        const sessions = loadSessionsFromStorage();
        const newSessions: Sessions = sessions || {};
        try {
          const session = await getSession(lastSignedIn as Did);
          const rpc = new Client({ handler: new OAuthUserAgent(session) });
          const res = await rpc.get("com.atproto.server.getSession");
          newSessions[lastSignedIn].signedIn = true;
          saveSessionToStorage(newSessions);
          if (!res.ok) throw res.data.error;
          return session;
        } catch (err) {
          newSessions[lastSignedIn].signedIn = false;
          saveSessionToStorage(newSessions);
          throw err;
        }
      }
    }
  };

  const session = await init();

  if (session) setAgent(new OAuthUserAgent(session));
};

export const resumeSession = async (did: Did): Promise<void> => {
  localStorage.setItem("lastSignedIn", did);
  await retrieveSession();
};
