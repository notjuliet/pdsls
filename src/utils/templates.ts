export type AtUri = { repo: string; collection: string; rkey: string };
type TemplateFn = (uri: AtUri, record?: any) => { label: string; link: string; icon?: string };
type TemplateMap = Record<string, TemplateFn>;

export const uriTemplates: TemplateMap = {
  "app.bsky.actor.profile": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}`,
    icon: "ri--bluesky",
  }),
  "app.bsky.feed.post": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}/post/${uri.rkey}`,
    icon: "ri--bluesky",
  }),
  "app.bsky.graph.list": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}/lists/${uri.rkey}`,
    icon: "ri--bluesky",
  }),
  "app.bsky.feed.generator": (uri) => ({
    label: "Bluesky",
    link: `https://bsky.app/profile/${uri.repo}/feed/${uri.rkey}`,
    icon: "ri--bluesky",
  }),
  "fyi.unravel.frontpage.post": (uri) => ({
    label: "Frontpage",
    link: `https://frontpage.fyi/post/${uri.repo}/${uri.rkey}`,
  }),
  "com.whtwnd.blog.entry": (uri) => ({
    label: "WhiteWind",
    link: `https://whtwnd.com/${uri.repo}/${uri.rkey}`,
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
  "blue.linkat.board": (uri) => ({
    label: "Linkat",
    link: `https://linkat.blue/${uri.repo}`,
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
  "pub.leaflet.document": (uri) => ({
    label: "Leaflet",
    link: `https://leaflet.pub/p/${uri.repo}/${uri.rkey}`,
    icon: "iconify-color i-leaflet",
  }),
};
