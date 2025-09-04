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
  XrpcHandleResolver,
} from "@atcute/identity-resolver";
import { Did, Handle } from "@atcute/lexicons";
import { isHandle } from "@atcute/lexicons/syntax";
import { createStore } from "solid-js/store";
import { setPDS } from "../components/navbar";

const didDocumentResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver({
      apiUrl: localStorage.plcDirectory ?? "https://plc.directory",
    }),
    web: new AtprotoWebDidDocumentResolver(),
  },
});

const handleResolver = new XrpcHandleResolver({
  serviceUrl: "https://public.api.bsky.app",
});

const didPDSCache: Record<string, string> = {};
const [labelerCache, setLabelerCache] = createStore<Record<string, string>>({});
const didDocCache: Record<string, DidDocument> = {};
const getPDS = async (did: string) => {
  if (did in didPDSCache) return didPDSCache[did];

  if (!isAtprotoDid(did)) {
    throw new Error("Not a valid DID identifier");
  }

  const doc = await didDocumentResolver.resolve(did);
  didDocCache[did] = doc;

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
  return await didDocumentResolver.resolve(did);
};

const validateHandle = async (handle: Handle, did: Did) => {
  if (!isHandle(handle)) return false;

  const handleResolver = new CompositeHandleResolver({
    strategy: "dns-first",
    methods: {
      dns: new DohJsonHandleResolver({ dohUrl: "https://dns.google/resolve?" }),
      http: new WellKnownHandleResolver(),
    },
  });

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
  setPDS(undefined);
  const pds = await getPDS(did);
  if (!pds) throw new Error("No PDS found");
  setPDS(pds.replace("https://", "").replace("http://", ""));
  return pds;
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
) => getConstellation("/links", target, collection, path, cursor, limit || 100);

const getDidBacklinks = (
  target: string,
  collection: string,
  path: string,
  cursor?: string,
  limit?: number,
) => getConstellation("/links/distinct-dids", target, collection, path, cursor, limit || 100);

export {
  didDocCache,
  getAllBacklinks,
  getDidBacklinks,
  getPDS,
  getRecordBacklinks,
  labelerCache,
  resolveDidDoc,
  resolveHandle,
  resolvePDS,
  validateHandle,
  type LinkData,
};
