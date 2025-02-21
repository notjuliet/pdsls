export type AtUri = { repo: string; collection: string; rkey: string };
type TemplateFn = (uri: AtUri) => { label: string; link: string };
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
  }),
  "blue.linkat.board": (uri) => ({
    label: "Linkat",
    link: `https://linkat.blue/${uri.repo}`,
  }),
};
