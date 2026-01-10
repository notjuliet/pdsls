import { LocalActorResolver } from "@atcute/identity-resolver";
import { configureOAuth } from "@atcute/oauth-browser-client";
import { didDocumentResolver, handleResolver } from "../utils/api";

const reactiveDidDocumentResolver = {
  resolve: async (did: string) => didDocumentResolver().resolve(did as any),
};

configureOAuth({
  metadata: {
    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URL,
  },
  identityResolver: new LocalActorResolver({
    handleResolver: handleResolver,
    didDocumentResolver: reactiveDidDocumentResolver,
  }),
});
