import { encode } from "@atcute/cbor";
import * as CID from "@atcute/cid";
import {
  getPublicKeyFromDidController,
  P256PrivateKeyExportable,
  P256PublicKey,
} from "@atcute/crypto";
import { getPdsEndpoint, type DidDocument } from "@atcute/identity";
import { fromBase64, toBase64Pad } from "@atcute/multibase";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";

import type { JSONType } from "../components/json";
import { didDocCache, getPDS, resolveDidDoc } from "./api";

export interface SpaceView {
  uri: string;
}

export interface SpaceRecord {
  collection: string;
  rkey: string;
  cid: string;
  value?: JSONType;
}

export interface SpaceRepo {
  did: string;
  rev: string;
}

export type SimpleSpacePolicy =
  | { kind: "public" }
  | { kind: "member-list" }
  | { kind: "managing-app"; managingApp: string }
  | { kind: "unknown"; type: string };

type SimpleSpaceAppAccess =
  | { kind: "open" }
  | { kind: "allow-list"; allowed: string[] }
  | { kind: "unknown"; type: string };

export interface SimpleSpaceInfo {
  uri: string;
  readPolicy: SimpleSpacePolicy;
  writePolicy: SimpleSpacePolicy;
  appAccess: SimpleSpaceAppAccess;
}

export type NewSimpleSpacePolicy = Exclude<SimpleSpacePolicy, { kind: "unknown" }>;
export type NewSimpleSpaceAppAccess = Exclude<SimpleSpaceAppAccess, { kind: "unknown" }>;

export interface SimpleSpaceConfiguration {
  readPolicy: NewSimpleSpacePolicy;
  writePolicy: NewSimpleSpacePolicy;
  appAccess: NewSimpleSpaceAppAccess;
}

interface CreateSimpleSpaceOptions extends SimpleSpaceConfiguration {
  type: string;
  skey?: string;
}

export interface CreateSimpleSpaceResult {
  uri: string;
}

export interface SimpleSpaceMember {
  did: string;
  read: boolean;
  write: boolean;
}

interface ListSpacesResult {
  cursor?: string;
  spaces: SpaceView[];
}

interface ListSpaceRecordsResult {
  cursor?: string;
  records: SpaceRecord[];
}

interface ListSpaceBlobsResult {
  cursor?: string;
  cids: string[];
}

interface ListSpaceReposResult {
  cursor?: string;
  repos: SpaceRepo[];
}

interface ListSimpleSpaceMembersResult {
  cursor?: string;
  members: SimpleSpaceMember[];
}

export interface GetSpaceRecordResult {
  uri: string;
  cid: string;
  value: JSONType;
  /** Present on records fetched with a space credential, for verifySpaceRecord. */
  mac?: SpaceRecordMac;
}

interface SpaceRecordMac {
  header: string | null;
  keyShare: KeyShare;
}

export interface SpaceRecordWriteResult {
  uri: string;
  cid: string;
  validationStatus?: string;
}

interface ParsedSpaceUri {
  authority: string;
  type: string;
  skey: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const parseSpaceRecordWriteResult = (
  data: unknown,
  operation: "creation" | "update",
): SpaceRecordWriteResult => {
  if (!isObject(data) || typeof data.uri !== "string" || typeof data.cid !== "string") {
    throw new Error(`The PDS returned an invalid Space record ${operation} response`);
  }

  return {
    uri: data.uri,
    cid: data.cid,
    validationStatus: typeof data.validationStatus === "string" ? data.validationStatus : undefined,
  };
};

const getErrorMessage = (data: unknown, status: number) => {
  if (isObject(data)) {
    if (typeof data.message === "string" && data.message) return data.message;
    if (typeof data.error === "string" && data.error) return data.error;
  }
  return `Spaces request failed with HTTP ${status}`;
};

class SpaceRequestError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(data: unknown, status: number) {
    super(getErrorMessage(data, status));
    this.name = "SpaceRequestError";
    this.status = status;
    this.code = isObject(data) && typeof data.error === "string" ? data.error : undefined;
  }
}

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const oauthQuery = async (
  auth: OAuthUserAgent,
  method: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<unknown> => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }

  const suffix = search.size ? `?${search}` : "";
  const response = await auth.handle(`/xrpc/${method}${suffix}`, {
    headers: { accept: "application/json" },
  });

  const data = await readJson(response);

  if (!response.ok) throw new SpaceRequestError(data, response.status);
  return data;
};

const oauthProcedure = async (
  auth: OAuthUserAgent,
  method: string,
  input: Record<string, unknown>,
): Promise<unknown> => {
  const response = await auth.handle(`/xrpc/${method}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const data = await readJson(response);

  if (!response.ok) throw new SpaceRequestError(data, response.status);
  return data;
};

interface SpaceCredentialSession {
  credential: string;
  expiresAt: number;
  key: P256PrivateKeyExportable;
}

const spaceHostCache = new Map<string, Promise<string>>();
const credentialSessions = new Map<string, SpaceCredentialSession>();
const pendingCredentialSessions = new Map<string, Promise<SpaceCredentialSession>>();

const requireSecureEndpoint = (endpoint: string, label: string): string => {
  const url = new URL(endpoint);
  const loopback =
    url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error(`${label} must use HTTPS`);
  }
  return endpoint;
};

const resolveSpaceHost = async (space: string): Promise<string> => {
  const parsed = parseSpaceUri(space);
  if (!parsed) throw new Error("Invalid Space reference");

  const existing = spaceHostCache.get(parsed.authority);
  if (existing) return existing;

  const pending = (async () => {
    const document = await resolveDidDoc(parsed.authority as `did:${string}:${string}`);
    const endpoint = getPdsEndpoint(document);
    if (!endpoint) throw new Error("The Space authority does not publish a PDS");
    return requireSecureEndpoint(endpoint, "The Space host");
  })();

  spaceHostCache.set(parsed.authority, pending);
  try {
    return await pending;
  } catch (err) {
    spaceHostCache.delete(parsed.authority);
    throw err;
  }
};

const resolveRepoHost = async (repo: string): Promise<string> =>
  requireSecureEndpoint(await getPDS(repo), "The repo host");

const getJwtExpiry = (jwt: string): number | undefined => {
  try {
    const encoded = jwt.split(".")[1];
    if (!encoded) return;
    const padded = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const payload: unknown = JSON.parse(atob(padded));
    if (isObject(payload) && typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    return;
  }
};

/**
 * Builds HTTP Message Signature headers (RFC 9421) for a request carrying a Space
 * credential, covering the credential and its audience DID.
 */
const spaceSignatureHeaders = async (
  key: P256PrivateKeyExportable,
  credential: string,
  audience: string,
): Promise<Record<string, string>> => {
  const authorization = `Atproto-Space-Credential ${credential}`;
  const signatureInput =
    '("authorization" "atproto-space-audience");tag="atproto-space-credential"';
  const lines = [
    `"authorization": ${authorization}`,
    `"atproto-space-audience": ${audience.trim()}`,
    `"@signature-params": ${signatureInput}`,
  ];

  const signature = await key.sign(new TextEncoder().encode(lines.join("\n")));
  return {
    authorization,
    "atproto-space-audience": audience,
    "signature-input": `atproto-space-credential=${signatureInput}`,
    signature: `atproto-space-credential=:${toBase64Pad(signature)}:`,
  };
};

const acquireSpaceCredential = async (
  auth: OAuthUserAgent,
  space: string,
): Promise<SpaceCredentialSession> => {
  const [host, key] = await Promise.all([
    resolveSpaceHost(space),
    P256PrivateKeyExportable.createKeypair(),
  ]);

  const delegation = await oauthQuery(auth, "com.atproto.space.getDelegationToken", { space });
  if (!isObject(delegation) || typeof delegation.token !== "string") {
    throw new Error("The PDS returned an invalid Space delegation token");
  }

  const exchangeUrl = new URL("/xrpc/com.atproto.space.getSpaceCredential", host);
  const response = await fetch(exchangeUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      space,
      credentialKid: await key.exportPublicKey("did"),
      delegationToken: delegation.token,
    }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    const message = getErrorMessage(data, response.status);
    if (isObject(data) && data.error === "AppNotAuthorized") {
      throw new Error(`${message}. This Space requires an approved application.`);
    }
    throw new Error(message);
  }
  if (!isObject(data) || typeof data.credential !== "string") {
    throw new Error("The Space authority returned an invalid credential");
  }

  return {
    credential: data.credential,
    expiresAt: getJwtExpiry(data.credential) ?? Date.now() + 60 * 60 * 1000,
    key,
  };
};

const getSpaceCredential = async (
  auth: OAuthUserAgent,
  space: string,
): Promise<SpaceCredentialSession> => {
  const key = `${auth.sub}\n${space}`;
  const existing = credentialSessions.get(key);
  if (existing && existing.expiresAt > Date.now() + 30_000) return existing;
  credentialSessions.delete(key);

  const pending = pendingCredentialSessions.get(key);
  if (pending) return pending;

  const request = acquireSpaceCredential(auth, space);
  pendingCredentialSessions.set(key, request);
  try {
    const session = await request;
    if (pendingCredentialSessions.get(key) === request) {
      credentialSessions.set(key, session);
    }
    return session;
  } finally {
    if (pendingCredentialSessions.get(key) === request) {
      pendingCredentialSessions.delete(key);
    }
  }
};

export const clearSpaceCredentials = (did: string) => {
  const prefix = `${did}\n`;
  for (const key of credentialSessions.keys()) {
    if (key.startsWith(prefix)) credentialSessions.delete(key);
  }
  for (const key of pendingCredentialSessions.keys()) {
    if (key.startsWith(prefix)) pendingCredentialSessions.delete(key);
  }
};

const clearCredentialsForSpace = (space: string) => {
  const suffix = `\n${space}`;
  for (const key of credentialSessions.keys()) {
    if (key.endsWith(suffix)) credentialSessions.delete(key);
  }
  for (const key of pendingCredentialSessions.keys()) {
    if (key.endsWith(suffix)) pendingCredentialSessions.delete(key);
  }
};

const credentialRequest = async (
  auth: OAuthUserAgent,
  space: string,
  audience: string,
  service: string,
  method: string,
  params: Record<string, string | number | boolean | undefined>,
  headers?: Record<string, string>,
): Promise<{ data: unknown; headers: Headers }> => {
  const session = await getSpaceCredential(auth, space);
  const url = new URL(`/xrpc/${method}`, service);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      ...(await spaceSignatureHeaders(session.key, session.credential, audience)),
      ...headers,
      accept: "application/json",
    },
  });
  const data = await readJson(response);
  if (!response.ok) throw new SpaceRequestError(data, response.status);
  return { data, headers: response.headers };
};

const credentialQuery = async (...args: Parameters<typeof credentialRequest>): Promise<unknown> =>
  (await credentialRequest(...args)).data;

const parseSimpleSpacePolicy = (value: unknown): SimpleSpacePolicy => {
  if (!isObject(value) || typeof value.$type !== "string") {
    throw new Error("The Space authority returned an invalid SimpleSpace policy");
  }

  switch (value.$type) {
    case "com.atproto.simplespace.defs#publicPolicy":
      return { kind: "public" };
    case "com.atproto.simplespace.defs#memberListPolicy":
      return { kind: "member-list" };
    case "com.atproto.simplespace.defs#managingAppPolicy":
      if (typeof value.managingApp !== "string") {
        throw new Error("The Space authority returned an invalid managing app policy");
      }
      return { kind: "managing-app", managingApp: value.managingApp };
    default:
      return { kind: "unknown", type: value.$type };
  }
};

const parseSimpleSpaceAppAccess = (value: unknown): SimpleSpaceAppAccess => {
  if (!isObject(value) || typeof value.$type !== "string") {
    throw new Error("The Space authority returned an invalid SimpleSpace app policy");
  }

  switch (value.$type) {
    case "com.atproto.simplespace.defs#open":
      return { kind: "open" };
    case "com.atproto.simplespace.defs#allowList":
      if (
        !Array.isArray(value.allowed) ||
        !value.allowed.every((item) => typeof item === "string")
      ) {
        throw new Error("The Space authority returned an invalid application allow list");
      }
      return { kind: "allow-list", allowed: value.allowed };
    default:
      return { kind: "unknown", type: value.$type };
  }
};

const encodeSimpleSpacePolicy = (policy: NewSimpleSpacePolicy) =>
  policy.kind === "managing-app"
    ? {
        $type: "com.atproto.simplespace.defs#managingAppPolicy",
        managingApp: policy.managingApp,
      }
    : {
        $type:
          policy.kind === "public"
            ? "com.atproto.simplespace.defs#publicPolicy"
            : "com.atproto.simplespace.defs#memberListPolicy",
      };

const encodeSimpleSpaceAppAccess = (appAccess: NewSimpleSpaceAppAccess) =>
  appAccess.kind === "allow-list"
    ? {
        $type: "com.atproto.simplespace.defs#allowList",
        allowed: appAccess.allowed,
      }
    : { $type: "com.atproto.simplespace.defs#open" };

const assertSimpleSpaceAuthority = (auth: OAuthUserAgent, space: string, action: string) => {
  const parsed = parseSpaceUri(space);
  if (!parsed) throw new Error("Invalid Space reference");
  if (parsed.authority !== auth.sub) {
    throw new Error(`Only the Space authority can ${action} this Space`);
  }
};

export const createSimpleSpace = async (
  auth: OAuthUserAgent,
  options: CreateSimpleSpaceOptions,
): Promise<CreateSimpleSpaceResult> => {
  const data = await oauthProcedure(auth, "com.atproto.simplespace.createSpace", {
    type: options.type,
    skey: options.skey,
    readPolicy: encodeSimpleSpacePolicy(options.readPolicy),
    writePolicy: encodeSimpleSpacePolicy(options.writePolicy),
    appAccess: encodeSimpleSpaceAppAccess(options.appAccess),
  });

  if (!isObject(data) || typeof data.uri !== "string" || !parseSpaceUri(data.uri)) {
    throw new Error("The PDS returned an invalid SimpleSpace creation response");
  }

  clearCredentialsForSpace(data.uri);
  return { uri: data.uri };
};

export const updateSimpleSpace = async (
  auth: OAuthUserAgent,
  space: string,
  config: SimpleSpaceConfiguration,
): Promise<void> => {
  assertSimpleSpaceAuthority(auth, space, "configure");

  await oauthProcedure(auth, "com.atproto.simplespace.updateSpace", {
    space,
    readPolicy: encodeSimpleSpacePolicy(config.readPolicy),
    writePolicy: encodeSimpleSpacePolicy(config.writePolicy),
    appAccess: encodeSimpleSpaceAppAccess(config.appAccess),
  });
  clearCredentialsForSpace(space);
};

export const deleteSimpleSpace = async (auth: OAuthUserAgent, space: string): Promise<void> => {
  assertSimpleSpaceAuthority(auth, space, "delete");

  await oauthProcedure(auth, "com.atproto.simplespace.deleteSpace", { space });
  clearCredentialsForSpace(space);
};

export const putSimpleSpaceMember = async (
  auth: OAuthUserAgent,
  space: string,
  member: SimpleSpaceMember,
): Promise<void> => {
  assertSimpleSpaceAuthority(auth, space, "manage members of");
  await oauthProcedure(auth, "com.atproto.simplespace.putMember", { space, ...member });
  clearCredentialsForSpace(space);
};

export const removeSimpleSpaceMember = async (
  auth: OAuthUserAgent,
  space: string,
  did: string,
): Promise<void> => {
  assertSimpleSpaceAuthority(auth, space, "remove members from");
  await oauthProcedure(auth, "com.atproto.simplespace.removeMember", { space, did });
  clearCredentialsForSpace(space);
};

export const getSimpleSpace = async (
  auth: OAuthUserAgent,
  space: string,
): Promise<SimpleSpaceInfo | undefined> => {
  const parsed = parseSpaceUri(space);
  if (!parsed) throw new Error("Invalid Space reference");

  let data: unknown;
  try {
    if (parsed.authority === auth.sub) {
      data = await oauthQuery(auth, "com.atproto.simplespace.getSpace", { space });
    } else {
      const host = await resolveSpaceHost(space);
      data = await credentialQuery(
        auth,
        space,
        parsed.authority,
        host,
        "com.atproto.simplespace.getSpace",
        { space },
      );
    }
  } catch (err) {
    if (
      err instanceof SpaceRequestError &&
      (err.status === 404 ||
        err.code === "SpaceNotFound" ||
        err.code === "XRPCNotSupported" ||
        err.code === "MethodNotImplemented")
    ) {
      return undefined;
    }
    throw err;
  }

  if (!isObject(data) || data.uri !== space) {
    throw new Error("The Space authority returned an invalid SimpleSpace response");
  }

  return {
    uri: data.uri,
    readPolicy: parseSimpleSpacePolicy(data.readPolicy),
    writePolicy: parseSimpleSpacePolicy(data.writePolicy),
    appAccess: parseSimpleSpaceAppAccess(data.appAccess),
  };
};

export const listSimpleSpaceMembers = async (
  auth: OAuthUserAgent,
  space: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<ListSimpleSpaceMembersResult> => {
  const limit = options.limit ?? 100;
  const data = await oauthQuery(auth, "com.atproto.simplespace.listMembers", {
    space,
    cursor: options.cursor,
    limit,
  });

  if (!isObject(data) || !Array.isArray(data.members)) {
    throw new Error("The PDS returned an invalid SimpleSpace member list");
  }

  return {
    // The alpha server can return the final member as a cursor even when the
    // page is already exhausted.
    cursor:
      data.members.length >= limit && typeof data.cursor === "string" ? data.cursor : undefined,
    members: data.members.flatMap((member): SimpleSpaceMember[] => {
      if (
        !isObject(member) ||
        typeof member.did !== "string" ||
        typeof member.read !== "boolean" ||
        typeof member.write !== "boolean"
      ) {
        throw new Error("The PDS returned invalid SimpleSpace member access");
      }
      return [{ did: member.did, read: member.read, write: member.write }];
    }),
  };
};

export const parseSpaceUri = (uri: string): ParsedSpaceUri | undefined => {
  const match = /^at:\/\/([^/]+)\/space\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!match) return;
  return { authority: match[1], type: match[2], skey: match[3] };
};

export const listSpaces = async (
  auth: OAuthUserAgent,
  options: { cursor?: string; limit?: number } = {},
): Promise<ListSpacesResult> => {
  const data = await oauthQuery(auth, "com.atproto.space.listSpaces", {
    cursor: options.cursor,
    limit: options.limit ?? 100,
  });

  if (!isObject(data) || !Array.isArray(data.spaces)) {
    throw new Error("The PDS returned an invalid Spaces response");
  }

  return {
    cursor: typeof data.cursor === "string" ? data.cursor : undefined,
    spaces: data.spaces.filter(
      (space): space is SpaceView => isObject(space) && typeof space.uri === "string",
    ),
  };
};

export const listSpaceRepos = async (
  auth: OAuthUserAgent,
  space: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<ListSpaceReposResult> => {
  const limit = options.limit ?? 1000;
  const parsed = parseSpaceUri(space);
  if (!parsed) throw new Error("Invalid Space reference");

  const host = await resolveSpaceHost(space);
  const data = await credentialQuery(
    auth,
    space,
    parsed.authority,
    host,
    "com.atproto.space.listRepos",
    {
      space,
      cursor: options.cursor,
      limit,
    },
  );

  if (!isObject(data) || !Array.isArray(data.repos)) {
    throw new Error("The Space authority returned an invalid writer list");
  }

  return {
    // Unlike the other list endpoints, the space host always returns the last
    // writer's spaceRev as the cursor, so a short page is what signals the end.
    cursor: data.repos.length >= limit && typeof data.cursor === "string" ? data.cursor : undefined,
    repos: data.repos.flatMap((repo): SpaceRepo[] => {
      if (!isObject(repo) || typeof repo.did !== "string" || typeof repo.repoRev !== "string") {
        return [];
      }
      return [{ did: repo.did, rev: repo.repoRev }];
    }),
  };
};

export const listSpaceRecords = async (
  auth: OAuthUserAgent,
  space: string,
  repo: string,
  options: {
    collection?: string;
    cursor?: string;
    excludeValues?: boolean;
    limit?: number;
    reverse?: boolean;
  } = {},
): Promise<ListSpaceRecordsResult> => {
  const pds = await resolveRepoHost(repo);
  const data = await credentialQuery(auth, space, repo, pds, "com.atproto.space.listRecords", {
    space,
    repo,
    collection: options.collection,
    cursor: options.cursor,
    excludeValues: options.excludeValues,
    limit: options.limit ?? 1000,
    reverse: options.reverse,
  });

  if (!isObject(data) || !Array.isArray(data.records)) {
    throw new Error("The PDS returned an invalid Space records response");
  }

  return {
    cursor: typeof data.cursor === "string" ? data.cursor : undefined,
    records: data.records.filter(
      (record): record is SpaceRecord =>
        isObject(record) &&
        typeof record.collection === "string" &&
        typeof record.rkey === "string" &&
        typeof record.cid === "string",
    ),
  };
};

export const listSpaceBlobs = async (
  auth: OAuthUserAgent,
  space: string,
  repo: string,
  options: { cursor?: string; limit?: number; since?: string } = {},
): Promise<ListSpaceBlobsResult> => {
  const pds = await resolveRepoHost(repo);
  const data = await credentialQuery(auth, space, repo, pds, "com.atproto.space.listBlobs", {
    space,
    repo,
    since: options.since,
    cursor: options.cursor,
    limit: options.limit ?? 1000,
  });

  if (!isObject(data) || !Array.isArray(data.cids)) {
    throw new Error("The PDS returned an invalid Space blobs response");
  }

  return {
    cursor: typeof data.cursor === "string" ? data.cursor : undefined,
    cids: data.cids.filter((cid): cid is string => typeof cid === "string"),
  };
};

export const getSpaceRecord = async (
  auth: OAuthUserAgent,
  space: string,
  repo: string,
  collection: string,
  rkey: string,
): Promise<GetSpaceRecordResult> => {
  const [pds, keyShare] = await Promise.all([resolveRepoHost(repo), createKeyShare()]);
  const { data, headers } = await credentialRequest(
    auth,
    space,
    repo,
    pds,
    "com.atproto.space.getRecord",
    { space, repo, collection, rkey },
    {
      "atproto-space-want-mac": `type="${RECORD_MAC_TYPE}", ver=${RECORD_MAC_VERSION}, key_share="${keyShare.did}"`,
    },
  );

  if (
    !isObject(data) ||
    typeof data.uri !== "string" ||
    typeof data.cid !== "string" ||
    data.value === undefined
  ) {
    throw new Error("The PDS returned an invalid Space record response");
  }

  return {
    uri: data.uri,
    cid: data.cid,
    value: data.value as JSONType,
    mac: { header: headers.get("atproto-space-mac"), keyShare },
  };
};

// Space records read with a credential are authenticated by a MAC keyed with a secret
// shared between us and the author's repo host: an ephemeral key of ours is combined
// (ECDH) with the author's #atproto_kem key, as in DHKEM(P-256, HKDF-SHA256).

const RECORD_MAC_TYPE = "atproto-space-record";
const RECORD_MAC_VERSION = 1;

interface KeyShare {
  did: string;
  privateKey: CryptoKey;
  /** Uncompressed point (0x04 || x || y). */
  publicKey: Uint8Array<ArrayBuffer>;
}

interface KemKey {
  multibase: string;
  key: CryptoKey;
  /** Uncompressed point (0x04 || x || y). */
  publicKey: Uint8Array<ArrayBuffer>;
}

const utf8 = (value: string) => new TextEncoder().encode(value);

const uint16be = (value: number) => new Uint8Array([value >> 8, value & 0xff]);

const concatBytes = (parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const lengthPrefixed = (value: string) => {
  const bytes = utf8(value);
  return concatBytes([uint16be(bytes.length), bytes]);
};

const KEM_PREFIX = concatBytes([utf8("HPKE-v1"), utf8("KEM"), uint16be(0x0010)]);

/** A fresh ephemeral key for each request, never reused. */
const createKeyShare = async (): Promise<KeyShare> => {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, [
    "deriveBits",
  ]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const did = await (await P256PublicKey.importRaw(publicKey)).exportPublicKey("did");
  return { did, privateKey: pair.privateKey, publicKey };
};

const getKemKey = async (repo: string, document: DidDocument): Promise<KemKey> => {
  const method = document.verificationMethod?.find(
    (method) => method.id === `${repo}#atproto_kem` || method.id === "#atproto_kem",
  );
  if (!method || !("publicKeyMultibase" in method) || !method.publicKeyMultibase) {
    throw new Error("The author's DID document has no #atproto_kem key");
  }
  const found = getPublicKeyFromDidController({
    type: method.type,
    publicKeyMultibase: method.publicKeyMultibase,
  });
  if (found.type !== "p256") throw new Error("The author's #atproto_kem key is not a P-256 key");

  // Going through JWK decompresses the point, which the derivation needs.
  const jwk = await (await P256PublicKey.importRaw(found.publicKeyBytes)).exportPublicKey("jwk");
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return { multibase: method.publicKeyMultibase, key, publicKey };
};

const resolveKemKey = async (repo: string, refresh: boolean): Promise<KemKey> => {
  let document = refresh ? undefined : didDocCache[repo];
  if (!document) {
    document = await resolveDidDoc(repo as `did:${string}:${string}`);
    didDocCache[repo] = document;
  }
  return getKemKey(repo, document);
};

const deriveSharedSecret = async (keyShare: KeyShare, kemKey: KemKey) => {
  const dh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: kemKey.key }, keyShare.privateKey, 256),
  );
  const input = await crypto.subtle.importKey(
    "raw",
    concatBytes([KEM_PREFIX, utf8("eae_prk"), dh]),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const info = concatBytes([
    uint16be(32),
    KEM_PREFIX,
    utf8("shared_secret"),
    keyShare.publicKey,
    kemKey.publicKey,
  ]);
  return crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info },
    input,
    256,
  );
};

/** Parses `type="atproto-space-record", ver=1, mac=:<base64>:` into the raw MAC. */
const parseRecordMacHeader = (header: string | null): Uint8Array<ArrayBuffer> => {
  if (!header) throw new Error("The PDS did not return a record MAC");

  const fields = new Map<string, string>();
  for (const member of header.split(",")) {
    const separator = member.indexOf("=");
    if (separator === -1) throw new Error("The PDS returned a malformed MAC header");
    fields.set(member.slice(0, separator).trim(), member.slice(separator + 1).trim());
  }
  if (fields.get("type") !== `"${RECORD_MAC_TYPE}"`) {
    throw new Error("The PDS returned a MAC of an unsupported type");
  }
  if (fields.get("ver") !== String(RECORD_MAC_VERSION)) {
    throw new Error("The PDS returned a MAC of an unsupported version");
  }
  const mac = /^:([A-Za-z0-9+/]*)=*:$/.exec(fields.get("mac") ?? "");
  if (!mac) throw new Error("The PDS returned a malformed MAC header");
  return fromBase64(mac[1]);
};

const checkRecordMac = async (record: GetSpaceRecordResult, kemKey: KemKey) => {
  if (!record.mac) throw new Error("The record was not fetched with a MAC");
  const mac = parseRecordMacHeader(record.mac.header);
  const key = await crypto.subtle.importKey(
    "raw",
    await deriveSharedSecret(record.mac.keyShare, kemKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const data = concatBytes([
    utf8(`${RECORD_MAC_TYPE}-v${RECORD_MAC_VERSION}`),
    lengthPrefixed(record.uri),
    CID.fromString(record.cid).bytes,
  ]);
  return crypto.subtle.verify("HMAC", key, mac, data);
};

/**
 * Checks a record from getSpaceRecord: that it is the requested record, that its MAC
 * proves it came from the author's repo host, and that its content matches its CID.
 * Throws with the reason when any check fails.
 */
export const verifySpaceRecord = async (
  auth: OAuthUserAgent,
  space: string,
  repo: string,
  collection: string,
  rkey: string,
  record: GetSpaceRecordResult,
): Promise<void> => {
  if (record.uri !== `${space}/${repo}/${collection}/${rkey}`) {
    throw new Error("The record URI does not match the requested record");
  }

  const kemKey = await resolveKemKey(repo, false);
  if (!(await checkRecordMac(record, kemKey))) {
    // The cached KEM key may have been rotated, so retry once with a fresh one.
    const refreshed = await resolveKemKey(repo, true);
    if (refreshed.multibase === kemKey.multibase) throw new Error("The record MAC is invalid");
    const retried = await getSpaceRecord(auth, space, repo, collection, rkey);
    if (retried.cid !== record.cid || !(await checkRecordMac(retried, refreshed))) {
      throw new Error("The record MAC is invalid");
    }
  }

  const computed = await CID.create(CID.CODEC_DCBOR, encode(record.value));
  if (CID.toString(computed) !== record.cid) {
    throw new Error("The record content does not match its CID");
  }
};

export const deleteSpaceRecord = async (
  auth: OAuthUserAgent,
  space: string,
  repo: string,
  collection: string,
  rkey: string,
): Promise<void> => {
  if (repo !== auth.sub) throw new Error("You can only delete your own Space records");

  await oauthProcedure(auth, "com.atproto.space.deleteRecord", {
    space,
    repo,
    collection,
    rkey,
  });
};

export const createSpaceRecord = async (
  auth: OAuthUserAgent,
  space: string,
  collection: string,
  record: JSONType,
  rkey?: string,
  validate?: boolean,
): Promise<SpaceRecordWriteResult> => {
  const data = await oauthProcedure(auth, "com.atproto.space.createRecord", {
    space,
    repo: auth.sub,
    collection,
    rkey,
    validate,
    record,
  });

  return parseSpaceRecordWriteResult(data, "creation");
};

export const putSpaceRecord = async (
  auth: OAuthUserAgent,
  space: string,
  repo: string,
  collection: string,
  rkey: string,
  record: JSONType,
  validate?: boolean,
): Promise<SpaceRecordWriteResult> => {
  if (repo !== auth.sub) throw new Error("You can only edit your own Space records");

  const data = await oauthProcedure(auth, "com.atproto.space.putRecord", {
    space,
    repo,
    collection,
    rkey,
    validate,
    record,
  });

  return parseSpaceRecordWriteResult(data, "update");
};

const MAX_SPACE_WRITES = 200;

export const deleteSpaceRecords = async (
  auth: OAuthUserAgent,
  space: string,
  repo: string,
  records: { collection: string; rkey: string }[],
): Promise<void> => {
  if (repo !== auth.sub) throw new Error("You can only delete your own Space records");

  for (let index = 0; index < records.length; index += MAX_SPACE_WRITES) {
    const writes = records.slice(index, index + MAX_SPACE_WRITES).map((record) => ({
      $type: "com.atproto.space.applyWrites#delete",
      collection: record.collection,
      rkey: record.rkey,
    }));

    await oauthProcedure(auth, "com.atproto.space.applyWrites", {
      space,
      repo,
      writes,
    });
  }
};

export const getSpaceBlob = async (
  auth: OAuthUserAgent,
  space: string,
  repo: string,
  cid: string,
): Promise<Blob> => {
  const [pds, session] = await Promise.all([
    resolveRepoHost(repo),
    getSpaceCredential(auth, space),
  ]);
  const url = new URL("/xrpc/com.atproto.space.getBlob", pds);
  url.search = new URLSearchParams({ space, repo, cid }).toString();
  const response = await fetch(url, {
    headers: {
      ...(await spaceSignatureHeaders(session.key, session.credential, repo)),
      accept: "*/*",
    },
  });

  if (!response.ok) {
    const data = await readJson(response);
    throw new Error(getErrorMessage(data, response.status));
  }

  return response.blob();
};
