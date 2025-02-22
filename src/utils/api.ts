import { CredentialManager, XRPC } from "@atcute/client";
import { query } from "@solidjs/router";
import { setPDS } from "../components/navbar";
import { DidDocument } from "@atcute/client/utils/did";
import { createStore } from "solid-js/store";

localStorage.constellationHost =
  localStorage.constellationHost || "https://links.bsky.bad-example.com";

const didPDSCache: Record<string, string> = {};
const [labelerCache, setLabelerCache] = createStore<Record<string, string>>({});
const didDocCache: Record<string, DidDocument> = {};
const getPDS = query(async (did: string) => {
  if (did in didPDSCache) return didPDSCache[did];
  const res = await fetch(
    did.startsWith("did:web") ?
      `https://${did.split(":")[2]}/.well-known/did.json`
    : "https://plc.directory/" + did,
  );

  return res.json().then((doc: DidDocument) => {
    if (!doc.service) throw new Error("No PDS found");
    for (const service of doc.service) {
      if (service.id === "#atproto_pds") {
        didPDSCache[did] = service.serviceEndpoint.toString();
        didDocCache[did] = doc;
      }
      if (service.id === "#atproto_labeler")
        setLabelerCache(did, service.serviceEndpoint.toString());
    }
    return didPDSCache[did];
  });
}, "getPDS");

const resolveHandle = async (handle: string) => {
  const rpc = new XRPC({
    handler: new CredentialManager({ service: "https://public.api.bsky.app" }),
  });
  const res = await rpc.get("com.atproto.identity.resolveHandle", {
    params: { handle: handle },
  });
  return res.data.did;
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
  const url = new URL(localStorage.constellationHost);
  url.pathname = endpoint;
  url.searchParams.set("target", target);
  if (collection) {
    if (!path)
      throw new Error("collection and path must either both be set or neither");
    url.searchParams.set("collection", collection);
    url.searchParams.set("path", path);
  } else {
    if (path)
      throw new Error("collection and path must either both be set or neither");
  }
  if (limit) url.searchParams.set("limit", `${limit}`);
  if (cursor) url.searchParams.set("cursor", `${cursor}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error("failed to fetch from constellation");
  return await res.json();
};

const getAllBacklinks = (target: string) =>
  getConstellation("/links/all", target);

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
) =>
  getConstellation(
    "/links/distinct-dids",
    target,
    collection,
    path,
    cursor,
    limit || 100,
  );

export {
  getPDS,
  getAllBacklinks,
  getRecordBacklinks,
  getDidBacklinks,
  labelerCache,
  didDocCache,
  resolveHandle,
  resolvePDS,
  type LinkData,
};
