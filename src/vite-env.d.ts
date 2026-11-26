/// <reference types="vite/client" />
/// <reference types="@atcute/bluesky/lexicons" />

import type {} from "@atcute/atproto";
import type {} from "@atcute/bluesky";

declare global {
  interface ImportMetaEnv {
    readonly VITE_DEV_SERVER_PORT?: string;
    /** Set by the dev server only. */
    readonly VITE_OAUTH_CLIENT_ID?: string;
    readonly VITE_OAUTH_REDIRECT_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
