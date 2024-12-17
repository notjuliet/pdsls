import { CredentialManager, XRPC } from "@atcute/client";
import { query } from "@solidjs/router";
import { setPDS } from "../main";
import { DidDoc } from "./types";

const didPDSCache: Record<string, string> = {};
const didDocCache: Record<string, DidDoc> = {};
const getPDS = query(async (did: string) => {
  if (did in didPDSCache) return didPDSCache[did];
  const res = await fetch(
    did.startsWith("did:web") ?
      `https://${did.split(":")[2]}/.well-known/did.json`
    : "https://plc.directory/" + did,
  );

  return res.json().then((doc: DidDoc) => {
    for (const service of doc.service) {
      if (service.id === "#atproto_pds") {
        didPDSCache[did] = service.serviceEndpoint;
        didDocCache[did] = doc;
        return service.serviceEndpoint;
      }
    }
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

export { getPDS, didDocCache, resolveHandle, resolvePDS };
