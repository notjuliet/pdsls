import "@atcute/atproto";
import { getPublicKeyFromDidController, P256PublicKey, Secp256k1PublicKey } from "@atcute/crypto";
import {
  type DidDocument,
  getAtprotoVerificationMaterial,
  getLabelerEndpoint,
  getPdsEndpoint,
  isAtprotoDid,
} from "@atcute/identity";
import {
  AtprotoWebDidDocumentResolver,
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  PlcDidDocumentResolver,
  WellKnownHandleResolver,
} from "@atcute/identity-resolver";
import { DohJsonLexiconAuthorityResolver, LexiconSchemaResolver } from "@atcute/lexicon-resolver";
import { Did, Handle } from "@atcute/lexicons";
import { AtprotoDid, isHandle, Nsid } from "@atcute/lexicons/syntax";
import { verifyRecord } from "@atcute/repo";
import { createMemo } from "solid-js";
import { createStore } from "solid-js/store";

import { plcDirectory } from "../views/settings";

const proxyFetch = (rewrite: (url: URL) => string): typeof fetch => {
  return async (input, init) => {
    try {
      return await fetch(input, init);
    } catch (err) {
      if (init?.signal?.aborted) throw err;
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      );
      return fetch(rewrite(url));
    }
  };
};

const didWebProxyFetch = proxyFetch(
  (url) => `/resolve-did-web?host=${encodeURIComponent(url.host)}`,
);
const dnsProxyFetch = proxyFetch(
  (url) =>
    `/resolve-handle-dns?handle=${encodeURIComponent(url.searchParams.get("name")?.replace("_atproto.", "") ?? "")}`,
);
const handleHttpProxyFetch = proxyFetch(
  (url) => `/resolve-handle-http?handle=${encodeURIComponent(url.host)}`,
);

export const didDocumentResolver = createMemo(
  () =>
    new CompositeDidDocumentResolver({
      methods: {
        plc: new PlcDidDocumentResolver({
          apiUrl: plcDirectory(),
        }),
        web: new AtprotoWebDidDocumentResolver({ fetch: didWebProxyFetch }),
      },
    }),
);

export const handleResolver = new CompositeHandleResolver({
  strategy: "dns-first",
  methods: {
    dns: new DohJsonHandleResolver({ dohUrl: "https://dns.google/resolve?", fetch: dnsProxyFetch }),
    http: new WellKnownHandleResolver({ fetch: handleHttpProxyFetch }),
  },
});

const authorityResolver = new DohJsonLexiconAuthorityResolver({
  dohUrl: "https://dns.google/resolve?",
});

const schemaResolver = createMemo(
  () =>
    new LexiconSchemaResolver({
      didDocumentResolver: didDocumentResolver(),
    }),
);

const didPDSCache: Record<string, Promise<string>> = {};
const [labelerCache, setLabelerCache] = createStore<Record<string, string>>({});
const didDocCache: Record<string, DidDocument> = {};
const getPDS = (did: string): Promise<string> => {
  if (did in didPDSCache) return didPDSCache[did];

  if (!isAtprotoDid(did)) {
    return Promise.reject(new Error("Not a valid DID identifier"));
  }

  didPDSCache[did] = (async () => {
    let doc: DidDocument;
    try {
      doc = await didDocumentResolver().resolve(did);
      didDocCache[did] = doc;
    } catch (e) {
      console.error(e);
      delete didPDSCache[did];
      throw new Error("Error during did document resolution");
    }

    const pds = getPdsEndpoint(doc);
    const labeler = getLabelerEndpoint(doc);

    if (labeler) {
      setLabelerCache(did, labeler);
    }

    if (!pds) {
      delete didPDSCache[did];
      throw new Error("No PDS found");
    }

    return pds;
  })();

  return didPDSCache[did];
};

const resolveHandle = async (handle: Handle) => {
  if (!isHandle(handle)) {
    throw new Error("Not a valid handle");
  }

  return await handleResolver.resolve(handle);
};

const resolveDidDoc = async (did: Did) => {
  if (!isAtprotoDid(did)) {
    throw new Error("Not a valid DID identifier");
  }
  return await didDocumentResolver().resolve(did);
};

const validateHandle = async (handle: Handle, did: Did) => {
  if (!isHandle(handle)) return false;

  let resolvedDid: string;
  try {
    resolvedDid = await handleResolver.resolve(handle);
  } catch (err) {
    console.error(err);
    return false;
  }
  if (resolvedDid !== did) return false;
  return true;
};

const resolveLexiconAuthority = async (nsid: Nsid) => {
  return await authorityResolver.resolve(nsid);
};

const resolveLexiconAuthorityDirect = async (authority: string) => {
  const dohUrl = "https://dns.google/resolve?";
  const reversedAuthority = authority.split(".").reverse().join(".");
  const domain = `_lexicon.${reversedAuthority}`;
  const url = new URL(dohUrl);
  url.searchParams.set("name", domain);
  url.searchParams.set("type", "TXT");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to resolve lexicon authority for ${authority}`);
  }

  const data = await response.json();
  if (!data.Answer || data.Answer.length === 0) {
    throw new Error(`No lexicon authority found for ${authority}`);
  }

  const txtRecord = data.Answer[0].data.replace(/"/g, "");

  if (!txtRecord.startsWith("did=")) {
    throw new Error(`Invalid lexicon authority record for ${authority}`);
  }

  return txtRecord.replace("did=", "");
};

const resolveLexiconSchema = async (authority: AtprotoDid, nsid: Nsid) => {
  return await schemaResolver().resolve(authority, nsid);
};

const lexiconSchemaCollection = "com.atproto.lexicon.schema";

const resolveRawLexiconSchema = async (authority: AtprotoDid, nsid: Nsid) => {
  const didDocument = await didDocumentResolver().resolve(authority);
  const pds = getPdsEndpoint(didDocument);
  if (!pds) throw new Error(`No PDS found for Lexicon authority ${authority}`);

  const url = new URL("/xrpc/com.atproto.sync.getRecord", pds);
  url.searchParams.set("did", authority);
  url.searchParams.set("collection", lexiconSchemaCollection);
  url.searchParams.set("rkey", nsid);

  const response = await fetch(url, {
    headers: { accept: "application/vnd.ipld.car" },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch the Lexicon type declaration (${response.status})`);
  }

  const controller = getAtprotoVerificationMaterial(didDocument);
  if (!controller) throw new Error("Lexicon authority has no verification key");

  const found = getPublicKeyFromDidController(controller);
  const publicKey =
    found.type === "p256"
      ? await P256PublicKey.importRaw(found.publicKeyBytes)
      : await Secp256k1PublicKey.importRaw(found.publicKeyBytes);
  const verified = await verifyRecord({
    did: authority,
    collection: lexiconSchemaCollection,
    rkey: nsid,
    publicKey,
    carBytes: new Uint8Array(await response.arrayBuffer()),
  });

  const rawSchema = verified.record;
  if (
    typeof rawSchema !== "object" ||
    rawSchema === null ||
    Array.isArray(rawSchema) ||
    !("$type" in rawSchema) ||
    rawSchema.$type !== lexiconSchemaCollection ||
    !("id" in rawSchema) ||
    rawSchema.id !== nsid
  ) {
    throw new Error("The resolved record is not the requested Lexicon type declaration");
  }

  return {
    uri: `at://${authority}/${lexiconSchemaCollection}/${nsid}`,
    cid: verified.cid,
    rawSchema,
  };
};

interface LinkData {
  links: {
    [key: string]: {
      [key: string]: {
        records: number;
        distinct_dids: number;
      };
    };
  };
}

type LinksWithRecords = {
  cursor: string;
  total: number;
  linking_records: Array<{ did: string; collection: string; rkey: string }>;
};

const getConstellation = async (
  endpoint: string,
  target: string,
  collection?: string,
  path?: string,
  cursor?: string,
  limit?: number,
) => {
  const url = new URL("https://constellation.microcosm.blue");
  url.pathname = endpoint;
  url.searchParams.set("target", target);
  if (collection) {
    if (!path) throw new Error("collection and path must either both be set or neither");
    url.searchParams.set("collection", collection);
    url.searchParams.set("path", path);
  } else {
    if (path) throw new Error("collection and path must either both be set or neither");
  }
  if (limit) url.searchParams.set("limit", `${limit}`);
  if (cursor) url.searchParams.set("cursor", `${cursor}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error("failed to fetch from constellation");
  return await res.json();
};

const getAllBacklinks = (target: string): Promise<LinkData> =>
  getConstellation("/links/all", target);

const getRecordBacklinks = (
  target: string,
  collection: string,
  path: string,
  cursor?: string,
  limit?: number,
): Promise<LinksWithRecords> =>
  getConstellation("/links", target, collection, path, cursor, limit || 100);

export interface HandleResolveResult {
  success: boolean;
  did?: string;
  error?: string;
}

export const resolveHandleDetailed = async (handle: Handle) => {
  const dnsResolver = new DohJsonHandleResolver({ dohUrl: "https://dns.google/resolve?" });
  const httpResolver = new WellKnownHandleResolver({ fetch: handleHttpProxyFetch });

  const tryResolve = async (
    resolver: DohJsonHandleResolver | WellKnownHandleResolver,
    timeoutMs: number = 5000,
  ): Promise<HandleResolveResult> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out")), timeoutMs),
      );
      const did = await Promise.race([resolver.resolve(handle), timeoutPromise]);
      return { success: true, did };
    } catch (err: any) {
      return { success: false, error: err.message ?? String(err) };
    }
  };

  const [dns, http] = await Promise.all([tryResolve(dnsResolver), tryResolve(httpResolver)]);

  return { dns, http };
};

export {
  didDocCache,
  getAllBacklinks,
  getPDS,
  getRecordBacklinks,
  labelerCache,
  resolveDidDoc,
  resolveHandle,
  resolveLexiconAuthority,
  resolveLexiconAuthorityDirect,
  resolveRawLexiconSchema,
  resolveLexiconSchema,
  validateHandle,
  type LinksWithRecords,
};
