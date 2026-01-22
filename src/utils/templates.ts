export type AtUri = { repo: string; collection: string; rkey: string };
type TemplateFn = (uri: AtUri, record?: any) => { label: string; link: string; icon?: string };
type TemplateMap = Record<string, TemplateFn>;

export const uriTemplates: TemplateMap = {
  "app.bsky.actor.profile": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}`,
    icon: "simple-icons--bluesky text-[#0085ff]",
  }),
  "app.bsky.feed.post": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}/post/${uri.rkey}`,
    icon: "simple-icons--bluesky text-[#0085ff]",
  }),
  "app.bsky.graph.list": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}/lists/${uri.rkey}`,
    icon: "simple-icons--bluesky text-[#0085ff]",
  }),
  "app.bsky.feed.generator": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}/feed/${uri.rkey}`,
    icon: "simple-icons--bluesky text-[#0085ff]",
  }),
  "fyi.unravel.frontpage.post": (uri) => ({
    label: "Frontpage",
    link: `https://frontpage.fyi/post/${uri.repo}/${uri.rkey}`,
  }),
  "com.shinolabs.pinksea.oekaki": (uri) => ({
    label: "PinkSea",
    link: `https://pinksea.art/${uri.repo}/oekaki/${uri.rkey}`,
    icon: "i-pinksea",
  }),
  "com.shinolabs.pinksea.profile": (uri) => ({
    label: "PinkSea",
    link: `https://pinksea.art/${uri.repo}`,
    icon: "i-pinksea",
  }),
  "sh.tangled.actor.profile": (uri) => ({
    label: "Tangled",
    link: `https://tangled.org/${uri.repo}`,
    icon: "i-tangled",
  }),
  "sh.tangled.repo": (uri, record) => ({
    label: "Tangled",
    link: `https://tangled.org/${uri.repo}/${record.name}`,
    icon: "i-tangled",
  }),
};
