import { LocalActorResolver } from "@atcute/identity-resolver";
import { configureOAuth } from "@atcute/oauth-browser-client";

import { didDocumentResolver, handleResolver } from "../lib/api";
import { oauthClientId, oauthRedirectUri } from "../lib/site-metadata";

const reactiveDidDocumentResolver = {
  resolve: async (did: string) => didDocumentResolver().resolve(did as any),
};

// The dev server sets a localhost client; a built site is its own client, whichever domain
// it's opened on.
configureOAuth({
  metadata: {
    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID ?? oauthClientId(location.origin),
    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URL ?? oauthRedirectUri(location.origin),
  },
  identityResolver: new LocalActorResolver({
    handleResolver: handleResolver,
    didDocumentResolver: reactiveDidDocumentResolver,
  }),
});
