import { ImageResponse } from "@takumi-rs/image-response/wasm";
import wasmModule from "./takumi_wasm_bg.wasm";

// Minimal createElement helper — avoids pulling in React
function h(type, props, ...children) {
  const flat = children.flat(Infinity).filter((c) => c != null && c !== false);
  return {
    type,
    props: {
      ...props,
      children:
        flat.length === 0 ? undefined
        : flat.length === 1 ? flat[0]
        : flat,
    },
  };
}

let fontData = null;
async function getFonts() {
  if (!fontData) {
    const urls = [
      [
        "Roboto Mono",
        "https://fonts.bunny.net/roboto-mono/files/roboto-mono-latin-400-normal.woff2",
      ],
      [
        "Noto Sans JP",
        "https://fonts.bunny.net/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff2",
      ],
      [
        "Noto Sans SC",
        "https://fonts.bunny.net/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff2",
      ],
      [
        "Noto Sans KR",
        "https://fonts.bunny.net/noto-sans-kr/files/noto-sans-kr-korean-400-normal.woff2",
      ],
      ["Noto Emoji", "https://fonts.bunny.net/noto-emoji/files/noto-emoji-emoji-400-normal.woff2"],
    ];
    const results = await Promise.all(
      urls.map(([name, url]) =>
        fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((data) => (data ? { data, name, weight: 400, style: "normal" } : null))
          .catch(() => null),
      ),
    );
    fontData = results.filter(Boolean);
  }
  return fontData;
}

async function fetchRecord(pdsUrl, repo, collection, rkey) {
  const url = `${pdsUrl}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) return null;
  return res.json();
}

const LOGO_PATH =
  "M14 1a3 3 0 0 1 2.348 4.868l2 3.203Q18.665 9 19 9a3 3 0 1 1-2.347 1.132l-2-3.203a3 3 0 0 1-1.304 0l-2.001 3.203c.408.513.652 1.162.652 1.868s-.244 1.356-.653 1.868l2.002 3.203Q13.664 17 14 17a3 3 0 1 1-2.347 1.132L9.65 14.929a3 3 0 0 1-1.302 0l-2.002 3.203a3 3 0 1 1-1.696-1.06l2.002-3.204A3 3 0 0 1 9.65 9.07l2.002-3.202A3 3 0 0 1 14 1";

// Colors matching json.tsx dark mode
const C = {
  key: "#818cf8", // indigo-400
  index: "#a78bfa", // violet-400
  string: "#f1f5f9", // slate-100
  quote: "#a3a3a3", // neutral-400
  number: "#f1f5f9", // slate-100
  boolean: "#fbbf24", // amber-400
  null: "#737373", // neutral-500
  guide: "#737373", // neutral-500
  colon: "#a3a3a3", // neutral-400
};

const MAX_STRING_WIDTH = 80;

function truncateToWidth(str, maxWidth) {
  let w = 0;
  let i = 0;
  const chars = [...str];
  for (; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0);
    const cw =
      (
        (cp >= 0x1100 && cp <= 0x115f) ||
        (cp >= 0x2e80 && cp <= 0x9fff) ||
        (cp >= 0xac00 && cp <= 0xd7af) ||
        (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0xfe10 && cp <= 0xfe6f) ||
        (cp >= 0xff01 && cp <= 0xff60) ||
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x20000 && cp <= 0x2fa1f)
      ) ?
        2
      : 1;
    if (w + cw > maxWidth) break;
    w += cw;
  }
  return i < chars.length ? chars.slice(0, i).join("") + "…" : str;
}
const MAX_LINES = 20;

// Flatten JSON into an array of { depth, segments } lines
// Each segment is { text, color }
function flattenJson(value, depth, lines, key, isIndex, maxStrWidth) {
  if (lines.length >= MAX_LINES) return;

  const keySegs = [];
  if (key !== undefined) {
    keySegs.push({ text: String(key), color: isIndex ? C.index : C.key });
    keySegs.push({ text: ":", color: C.colon, mr: 4 });
  }

  if (value === null) {
    lines.push({ depth, segments: [...keySegs, { text: "null", color: C.null }] });
  } else if (typeof value === "boolean") {
    lines.push({ depth, segments: [...keySegs, { text: String(value), color: C.boolean }] });
  } else if (typeof value === "number") {
    lines.push({ depth, segments: [...keySegs, { text: String(value), color: C.number }] });
  } else if (typeof value === "string") {
    const display = value.replace(/\n/g, " ");
    const truncated = truncateToWidth(display, maxStrWidth - 2);
    lines.push({
      depth,
      segments: [
        ...keySegs,
        { text: '"', color: C.quote },
        { text: truncated, color: C.string },
        { text: '"', color: C.quote },
      ],
    });
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push({ depth, segments: [...keySegs, { text: "[ ]", color: C.null }] });
    } else {
      if (key !== undefined) {
        lines.push({
          depth,
          segments: [
            { text: String(key), color: isIndex ? C.index : C.key },
            { text: ":", color: C.colon },
          ],
        });
      }
      for (let i = 0; i < value.length; i++) {
        if (lines.length >= MAX_LINES) break;
        flattenJson(value[i], depth + 1, lines, `#${i}`, true, maxStrWidth);
      }
    }
  } else {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      lines.push({ depth, segments: [...keySegs, { text: "{ }", color: C.null }] });
    } else {
      if (key !== undefined) {
        lines.push({
          depth,
          segments: [
            { text: String(key), color: isIndex ? C.index : C.key },
            { text: ":", color: C.colon },
          ],
        });
      }
      for (const k of keys) {
        if (lines.length >= MAX_LINES) break;
        flattenJson(value[k], depth + 1, lines, k, false, maxStrWidth);
      }
    }
  }
}

function renderLine(line, guideMargin) {
  const guides = [];
  for (let i = 0; i < line.depth; i++) {
    guides.push(
      h("div", {
        style: {
          width: 1,
          backgroundColor: C.guide,
          marginRight: guideMargin,
          flexShrink: 0,
        },
      }),
    );
  }
  return h(
    "div",
    { style: { display: "flex", overflow: "hidden", whiteSpace: "nowrap" } },
    ...guides,
    ...line.segments.map((seg) =>
      h(
        "div",
        { style: { color: seg.color, ...(seg.mr ? { marginRight: seg.mr } : {}) } },
        seg.text,
      ),
    ),
  );
}

function OgImage({ record }) {
  const lines = [];
  for (const k of Object.keys(record)) {
    if (lines.length >= MAX_LINES) break;
    flattenJson(record[k], 0, lines, k, false, MAX_STRING_WIDTH);
  }
  if (lines.length >= MAX_LINES) {
    lines.push({ depth: 0, segments: [{ text: "…", color: C.null }] });
  }

  const availableHeight = 630 - 100; // height minus vertical padding
  const fontSize = Math.min(32, Math.max(18, Math.floor(availableHeight / (lines.length * 1.5))));
  const guideMargin = Math.round(fontSize * 1.2) - 1;

  // Re-truncate string values if the larger font size means fewer chars fit.
  // Available width: 1200 canvas - 100 padding - 80 logo area - 200 for key/depth overhead;
  // Roboto Mono char ≈ 0.6× fontSize.
  const maxStrWidth = Math.floor((1200 - 100 - 80 - 200) / (fontSize * 0.6));
  if (maxStrWidth < MAX_STRING_WIDTH) {
    for (const line of lines) {
      for (const seg of line.segments) {
        if (seg.color === C.string) {
          seg.text = truncateToWidth(seg.text, maxStrWidth - 2);
        }
      }
    }
  }

  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#1f1f1f",
        padding: "50px 50px",
        fontFamily: "Roboto Mono, Noto Sans JP, Noto Sans SC, Noto Sans KR, Noto Emoji",
        fontSize,
        lineHeight: 1.5,
        color: "#e2e8f0",
      },
    },
    h(
      "div",
      {
        style: {
          position: "absolute",
          bottom: 32,
          right: 32,
        },
      },
      h(
        "svg",
        { viewBox: "0 0 24 24", width: 48, height: 48 },
        h("path", { fill: "#76c4e5", d: LOGO_PATH }),
      ),
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", paddingRight: 80 } },
      ...lines.map((line) => renderLine(line, guideMargin)),
    ),
  );
}

async function handleOgImage(searchParams) {
  const did = searchParams.get("did");
  const collection = searchParams.get("collection");
  const rkey = searchParams.get("rkey");

  if (!did || !collection || !rkey) {
    return new Response("Missing params", { status: 400 });
  }

  const doc = await resolveDidDoc(did).catch(() => null);
  const pdsUrl = doc ? pdsFromDoc(doc) : null;
  if (!pdsUrl) {
    return new Response("Could not resolve PDS", { status: 404 });
  }

  const data = await fetchRecord(pdsUrl, did, collection, rkey).catch(() => null);
  if (!data?.value) {
    return new Response("Record not found", { status: 404 });
  }

  const fonts = await getFonts();

  return new ImageResponse(OgImage({ record: data.value }), {
    width: 1200,
    height: 630,
    module: wasmModule,
    fonts,
    format: "png",
  });
}

// ---- existing worker logic ----

const BOT_UAS = [
  "Discordbot",
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Slackbot-LinkExpanding",
  "TelegramBot",
  "WhatsApp",
  "Iframely",
  "Embedly",
  "redditbot",
  "Cardyb",
];

function isBot(ua) {
  return BOT_UAS.some((b) => ua.includes(b));
}

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resolveDidDoc(did) {
  let docUrl;
  if (did.startsWith("did:plc:")) {
    docUrl = `https://plc.directory/${did}`;
  } else if (did.startsWith("did:web:")) {
    const host = did.slice("did:web:".length);
    docUrl = `https://${host}/.well-known/did.json`;
  } else {
    return null;
  }

  const res = await fetch(docUrl, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) return null;
  return res.json();
}

function pdsFromDoc(doc) {
  return doc.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint ?? null;
}

function handleFromDoc(doc) {
  const aka = doc.alsoKnownAs?.find((a) => a.startsWith("at://"));
  return aka ? aka.slice("at://".length) : null;
}

const STATIC_ROUTES = {
  "/": { title: "PDSls", description: "Browse the public data on atproto" },
  "/jetstream": {
    title: "Jetstream",
    description: "A simplified event stream with support for collection and DID filtering.",
  },
  "/firehose": { title: "Firehose", description: "The raw event stream from a relay or PDS." },
  "/spacedust": {
    title: "Spacedust",
    description: "A stream of links showing interactions across the network.",
  },
  "/labels": { title: "Labels", description: "Query labels applied to accounts and records." },
  "/car": {
    title: "Archive tools",
    description: "Tools for working with CAR (Content Addressable aRchive) files.",
  },
  "/car/explore": {
    title: "Explore archive",
    description: "Upload a CAR file to explore its contents.",
  },
  "/car/unpack": {
    title: "Unpack archive",
    description: "Upload a CAR file to extract all records into a ZIP archive.",
  },
  "/settings": { title: "Settings", description: "Browse the public data on atproto" },
};

async function resolveOgData(pathname) {
  if (pathname in STATIC_ROUTES) return STATIC_ROUTES[pathname];

  let title = "PDSls";
  let description = "Browse the public data on atproto";

  const segments = pathname.slice(1).split("/").filter(Boolean);
  const isAtUrl = segments[0] === "at:";

  if (isAtUrl) {
    // at://did[/collection[/rkey]]
    const [, did, collection, rkey] = segments;

    if (!did) {
      // bare /at: — use defaults
    } else if (!collection) {
      const doc = await resolveDidDoc(did).catch(() => null);
      const handle = doc ? handleFromDoc(doc) : null;
      const pdsUrl = doc ? pdsFromDoc(doc) : null;
      const pdsHost = pdsUrl ? pdsUrl.replace("https://", "").replace("http://", "") : null;

      title = handle ? `${handle} (${did})` : did;
      description = pdsHost ? `Hosted on ${pdsHost}` : `Repository for ${did}`;
    } else if (!rkey) {
      const doc = await resolveDidDoc(did).catch(() => null);
      const handle = doc ? handleFromDoc(doc) : null;
      title = `at://${handle ?? did}/${collection}`;
      description = `List of ${collection} records from ${handle ?? did}`;
    } else {
      const doc = await resolveDidDoc(did).catch(() => null);
      const handle = doc ? handleFromDoc(doc) : null;
      description = "";
      title = `at://${handle ?? did}/${collection}/${rkey}`;
      return { title, description, generateImage: true, did, collection, rkey };
    }
  } else {
    // /pds
    const [pds] = segments;
    if (pds) {
      title = pds;
      description = `Browse the repositories at ${pds}`;
    }
  }

  return { title, description };
}

class OgTagRewriter {
  constructor(ogData, url) {
    this.ogData = ogData;
    this.url = url;
  }

  element(element) {
    const property = element.getAttribute("property");
    const name = element.getAttribute("name");

    if (
      property === "og:title" ||
      property === "og:description" ||
      property === "og:url" ||
      property === "og:type" ||
      property === "og:site_name" ||
      property === "og:image" ||
      property === "description" ||
      name === "description" ||
      name === "twitter:card" ||
      name === "twitter:title" ||
      name === "twitter:description" ||
      name === "twitter:image"
    ) {
      element.remove();
    }
  }
}

class HeadEndRewriter {
  constructor(ogData, imageUrl) {
    this.ogData = ogData;
    this.imageUrl = imageUrl;
  }

  element(element) {
    const t = esc(this.ogData.title);
    const d = esc(this.ogData.description);
    const i = this.imageUrl ? esc(this.imageUrl) : null;

    const imageTags =
      i ?
        `\n  <meta property="og:image" content="${i}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${i}" />`
      : `\n  <meta name="twitter:card" content="summary" />`;

    element.append(
      `<meta property="og:title" content="${t}" />
  <meta property="og:type" content="website" />
  <meta property="og:description" content="${d}" />
  <meta property="og:site_name" content="PDSls" />
  <meta name="description" content="${d}" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />${imageTags}`,
      { html: true },
    );
  }
}

const MAX_FAVICON_SIZE = 100 * 1024; // 100KB

async function corsProxy(url, fetchOpts = {}) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(5000),
    ...fetchOpts,
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function handleResolveDidWeb(searchParams) {
  const host = searchParams.get("host");
  if (!host) return new Response("Missing host param", { status: 400 });
  return corsProxy(`https://${host}/.well-known/did.json`, {
    redirect: "manual",
    headers: { accept: "application/did+ld+json,application/json" },
  });
}

function handleResolveHandleDns(searchParams) {
  const handle = searchParams.get("handle");
  if (!handle) return new Response("Missing handle param", { status: 400 });
  const url = new URL("https://dns.google/resolve");
  url.searchParams.set("name", `_atproto.${handle}`);
  url.searchParams.set("type", "TXT");
  return corsProxy(url, { headers: { accept: "application/dns-json" } });
}

function handleResolveHandleHttp(searchParams) {
  const handle = searchParams.get("handle");
  if (!handle) return new Response("Missing handle param", { status: 400 });
  return corsProxy(`https://${handle}/.well-known/atproto-did`, { redirect: "manual" });
}

async function handleFavicon(searchParams) {
  const domain = searchParams.get("domain");
  if (!domain) {
    return new Response("Missing domain param", { status: 400 });
  }

  let faviconUrl = null;
  try {
    const pageRes = await fetch(`https://${domain}/`, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "PDSls-Favicon/1.0" },
      redirect: "follow",
    });

    if (pageRes.ok && (pageRes.headers.get("content-type") ?? "").includes("text/html")) {
      let bestHref = null;
      let bestPriority = -1;
      let bestSize = 0;

      const rewriter = new HTMLRewriter().on("link", {
        element(el) {
          const rel = (el.getAttribute("rel") ?? "").toLowerCase();
          if (!rel.includes("icon")) return;
          const href = el.getAttribute("href");
          if (!href) return;

          // Prefer icon with sizes > icon > apple-touch-icon > shortcut icon
          let priority = 0;
          if (rel === "icon" && el.getAttribute("sizes")) priority = 3;
          else if (rel === "icon") priority = 2;
          else if (rel === "apple-touch-icon") priority = 1;

          const sizesAttr = el.getAttribute("sizes") ?? "";
          const size = Math.max(...sizesAttr.split(/\s+/).map((s) => parseInt(s) || 0), 0);

          if (
            priority > bestPriority ||
            (priority === bestPriority && size > bestSize && size <= 64)
          ) {
            bestPriority = priority;
            bestSize = size;
            bestHref = href;
          }
        },
      });

      const transformed = rewriter.transform(pageRes);
      await transformed.text();

      if (bestHref) {
        try {
          faviconUrl = new URL(bestHref, `https://${domain}/`).href;
        } catch {
          faviconUrl = null;
        }
      }
    }
  } catch {}

  if (!faviconUrl) {
    faviconUrl = `https://${domain}/favicon.ico`;
  }

  try {
    const iconRes = await fetch(faviconUrl, {
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });

    if (!iconRes.ok) {
      return new Response("Favicon not found", { status: 404 });
    }

    const contentType = iconRes.headers.get("content-type") ?? "";
    if (!contentType.includes("image") && !contentType.includes("icon")) {
      return new Response("Not an image", { status: 404 });
    }

    const contentLength = parseInt(iconRes.headers.get("content-length") ?? "0", 10);
    if (contentLength > MAX_FAVICON_SIZE) {
      return new Response("Favicon too large", { status: 413 });
    }

    const body = await iconRes.arrayBuffer();
    if (body.byteLength > MAX_FAVICON_SIZE) {
      return new Response("Favicon too large", { status: 413 });
    }

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Failed to fetch favicon", { status: 502 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/og-image") {
      return handleOgImage(url.searchParams).catch(
        (err) => new Response(`Failed to generate image: ${err?.message ?? err}`, { status: 500 }),
      );
    }

    if (url.pathname === "/favicon") {
      return handleFavicon(url.searchParams).catch(
        (err) => new Response(`Failed to fetch favicon: ${err?.message ?? err}`, { status: 500 }),
      );
    }

    const proxyRoutes = {
      "/resolve-did-web": handleResolveDidWeb,
      "/resolve-handle-dns": handleResolveHandleDns,
      "/resolve-handle-http": handleResolveHandleHttp,
    };

    if (url.pathname in proxyRoutes) {
      return proxyRoutes[url.pathname](url.searchParams).catch(
        (err) => new Response(`Proxy error: ${err?.message ?? err}`, { status: 500 }),
      );
    }

    const ua = request.headers.get("user-agent") ?? "";

    if (!isBot(ua)) {
      return env.ASSETS.fetch(request);
    }

    let ogData;
    try {
      ogData = await resolveOgData(url.pathname);
    } catch {
      return env.ASSETS.fetch(request);
    }

    const imageUrl =
      ogData.generateImage ?
        `${url.origin}/og-image?` +
        new URLSearchParams({ did: ogData.did, collection: ogData.collection, rkey: ogData.rkey })
      : null;

    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    return new HTMLRewriter()
      .on("meta", new OgTagRewriter(ogData, request.url))
      .on("head", new HeadEndRewriter(ogData, imageUrl))
      .transform(response);
  },
};
