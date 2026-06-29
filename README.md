# PDSls - Atmosphere Explorer

Lightweight web app to navigate [atproto](https://atproto.com/).

## Hacking

You will need `bun` to get started:

```
bun install              # install deps
bun run dev              # runs local dev server
bun run build            # bundles the production app
bunx wrangler pages dev  # runs worker locally
```

Set `APP_DOMAIN` (default: `pdsls.dev`) and `APP_PROTOCOL` (default: `https`) to configure the base URL used in the generated OAuth and OpenSearch metadata files.

Cloudflare Pages builds should use `bun run pages:build` with `dist` as the build output directory.

## Logo

The shareable SVG logo lives in `public/pdsls-logo.svg`.
