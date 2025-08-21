# PDSls - AT Protocol Explorer

Lightweight and client-side web app to navigate [atproto](https://atproto.com/).

## Features

- Browse the public data on PDSes (Personal Data Servers).
- Login to manage records in your repository.
- Jetstream and firehose streaming.
- Backlinks support with [constellation](https://constellation.microcosm.blue/).
- Query moderation labels.

## Hacking

You will need `node` and `pnpm` to get started:

```
pnpm i      # install deps
pnpm dev    # or pnpm run start, runs vite
pnpm build  # runs vite build
pnpm serve  # runs vite preview
```

## Credits

[atcute](https://github.com/mary-ext/atcute) - atproto SDK\
[@skyware/firehose](https://github.com/skyware-js/firehose) - Firehose client\
