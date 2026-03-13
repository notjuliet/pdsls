# PDSls - Atmosphere Explorer

Lightweight web app to navigate [atproto](https://atproto.com/).

## Hacking

You will need `node` and `pnpm` to get started:

```
pnpm i                   # install deps
pnpm dev                 # runs local dev server
pnpm build               # bundles the production app
pnpx wrangler pages dev  # runs worker locally
```

Set `APP_DOMAIN` (default: `pdsls.dev`) and `APP_PROTOCOL` (default: `https`) to configure the base URL used in the generated OAuth and OpenSearch metadata files.
