# PDSls - Atmosphere Explorer

Lightweight web app to navigate [atproto](https://atproto.com/).

## Hacking

You will need `bun` to get started:

```
bun install              # install deps
bun run dev              # runs local dev server
bun run build            # bundles the production app
bunx wrangler dev         # runs the built site and worker locally
bun run deploy           # builds and deploys the worker
```

The site is one Cloudflare Worker with static assets (`wrangler.toml`). It can be attached to any number of domains: the OAuth client metadata and OpenSearch file are made per request from the domain the site is opened on.

## Logo

The shareable SVG logo lives in `public/pdsls-logo.svg`.
