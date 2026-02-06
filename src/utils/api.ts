import "@atcute/atproto";
import {
  type DidDocument,
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
import { createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import { setPDS } from "../components/navbar";
import { plcDirectory } from "../views/settings";

export const didDocumentResolver = createMemo(
  () =>
    new CompositeDidDocumentResolver({
      methods: {
        plc: new PlcDidDocumentResolver({
          apiUrl: plcDirectory(),
        }),
        web: new AtprotoWebDidDocumentResolver(),
      },
    }),
);

export const handleResolver = new CompositeHandleResolver({
  strategy: "dns-first",
  methods: {
    dns: new DohJsonHandleResolver({ dohUrl: "https://dns.google/resolve?" }),
    http: new WellKnownHandleResolver(),
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

const didPDSCache: Record<string, string> = {};
const [labelerCache, setLabelerCache] = createStore<Record<string, string>>({});
const didDocCache: Record<string, DidDocument> = {};
const getPDS = async (did: string) => {
  if (did in didPDSCache) return didPDSCache[did];

  if (!isAtprotoDid(did)) {
    throw new Error("Not a valid DID identifier");
  }

  let doc: DidDocument;
  try {
    doc = await didDocumentResolver().resolve(did);
    didDocCache[did] = doc;
  } catch (e) {
    console.error(e);
    throw new Error("Error during did document resolution");
  }

  const pds = getPdsEndpoint(doc);
  const labeler = getLabelerEndpoint(doc);

  if (labeler) {
    setLabelerCache(did, labeler);
  }

  if (!pds) {
    throw new Error("No PDS found");
  }

  return (didPDSCache[did] = pds);
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

const resolvePDS = async (did: string) => {
  try {
    setPDS(undefined);
    const pds = await getPDS(did);
    if (!pds) throw new Error("No PDS found");
    setPDS(pds.replace("https://", "").replace("http://", ""));
    return pds;
  } catch (err) {
    setPDS("Missing PDS");
    throw err;
  }
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

const getAllBacklinks = (target: string) => getConstellation("/links/all", target);

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
  const httpResolver = new WellKnownHandleResolver();

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
  resolveLexiconSchema,
  resolvePDS,
  validateHandle,
  type LinkData,
  type LinksWithRecords,
};
