import { execSync } from "child_process";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

import { OAUTH_SCOPE } from "./src/lib/site-metadata";

const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = 13213;

const getVersion = (): string => {
  try {
    const describe = execSync("git describe --tags --long --dirty --always").toString().trim();

    const match = describe.match(/^v?(.+?)-(\d+)-g([a-f0-9]+)(-dirty)?$/);

    if (match) {
      const [, version, commits, hash, dirty] = match;
      if (commits === "0") {
        return `v${version}${dirty ? "-dirty" : ""}`;
      }
      return `v${version}.dev${commits}+g${hash}${dirty ? "-dirty" : ""}`;
    }

    return `v0.0.0.dev+g${describe}`;
  } catch {
    return "v0.0.0-unknown";
  }
};

export default defineConfig({
  plugins: [
    tailwindcss(),
    solidPlugin(),
    {
      name: "oauth",
      config(_conf, { command }) {
        // A built site works its client out from the domain it's opened on.
        if (command !== "build") {
          const redirectUri = `http://${SERVER_HOST}:${SERVER_PORT}/`;

          const clientId =
            `http://localhost` +
            `?redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(OAUTH_SCOPE)}`;

          process.env.VITE_DEV_SERVER_PORT = "" + SERVER_PORT;
          process.env.VITE_OAUTH_CLIENT_ID = clientId;
          process.env.VITE_OAUTH_REDIRECT_URL = redirectUri;
        }

        process.env.VITE_APP_VERSION = getVersion();
      },
    },
  ],
  server: {
    host: SERVER_HOST,
    port: SERVER_PORT,
  },
  build: {
    target: "esnext",
  },
  resolve: {
    dedupe: [
      "codemirror",
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/language",
      "@codemirror/lint",
      "@codemirror/commands",
      "@codemirror/search",
      "@codemirror/autocomplete",
    ],
  },
});
