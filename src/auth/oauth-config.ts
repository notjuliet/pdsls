import { configureOAuth, defaultIdentityResolver } from "@atcute/oauth-browser-client";
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
