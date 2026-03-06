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
      description = `View the ${rkey} record in ${collection} from ${handle ?? did}`;
      title = `at://${handle ?? did}/${collection}/${rkey}`;
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
      property === "description" ||
      name === "description" ||
      name === "twitter:card" ||
      name === "twitter:title" ||
      name === "twitter:description"
    ) {
      element.remove();
    }
  }
}

class HeadEndRewriter {
  constructor(ogData, url) {
    this.ogData = ogData;
    this.url = url;
  }

  element(element) {
    const t = esc(this.ogData.title);
    const d = esc(this.ogData.description);
    const u = esc(this.url);

    element.append(
      `<meta property="og:title" content="${t}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${u}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:site_name" content="PDSls" />
  <meta name="description" content="${d}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />`,
      { html: true },
    );
  }
}

export default {
  async fetch(request, env) {
    const ua = request.headers.get("user-agent") ?? "";

    if (!isBot(ua)) {
      return env.ASSETS.fetch(request);
    }

    const url = new URL(request.url);

    let ogData;
    try {
      ogData = await resolveOgData(url.pathname);
    } catch {
      return env.ASSETS.fetch(request);
    }

    const response = await env.ASSETS.fetch(request);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    return new HTMLRewriter()
      .on("meta", new OgTagRewriter(ogData, request.url))
      .on("head", new HeadEndRewriter(ogData, request.url))
      .transform(response);
  },
};
