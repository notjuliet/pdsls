export type AtUri = { repo: string; collection: string; rkey: string };
type TemplateFn = (uri: AtUri, record?: any) => { label: string; link: string };
type TemplateMap = Record<string, TemplateFn>;

export const uriTemplates: TemplateMap = {
  "app.bsky.actor.profile": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}`,
  }),
  "app.bsky.feed.post": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}/post/${uri.rkey}`,
  }),
  "app.bsky.graph.list": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}/lists/${uri.rkey}`,
  }),
  "app.bsky.feed.generator": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}/feed/${uri.rkey}`,
  }),
  "com.shinolabs.pinksea.oekaki": (uri) => ({
    label: "PinkSea",
    link: `https://pinksea.art/${uri.repo}/oekaki/${uri.rkey}`,
  }),
  "com.shinolabs.pinksea.profile": (uri) => ({
    label: "PinkSea",
    link: `https://pinksea.art/${uri.repo}`,
  }),
  "sh.tangled.actor.profile": (uri) => ({
    label: "Tangled",
    link: `https://tangled.org/${uri.repo}`,
  }),
  "sh.tangled.repo": (uri, record) => ({
    label: "Tangled",
    link: `https://tangled.org/${uri.repo}/${record.name}`,
  }),
  "app.blento.card": (uri) => ({
    label: "blento",
    link: `https://blento.app/${uri.repo}`,
  }),
  "social.popfeed.actor.profile": (uri) => ({
    label: "Popfeed",
    link: `https://popfeed.social/profile/${uri.repo}`,
  }),
  "social.popfeed.feed.review": (uri) => ({
    label: "Popfeed",
    link: `https://popfeed.social/review/at:/${uri.repo}/${uri.collection}/${uri.rkey}`,
  }),
  "social.popfeed.feed.list": (uri) => ({
    label: "Popfeed",
    link: `https://popfeed.social/list/at:/${uri.repo}/${uri.collection}/${uri.rkey}`,
  }),
};
