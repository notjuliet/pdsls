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

/**
 * A space's policy, which decides who may read and write in it. The PDS supports three:
 * personal (only the owner), member (a member list, optionally public), and managed (an app
 * decides). Any other `$type` is shown but can't be edited.
 */
export type SpacePolicy =
  | { kind: "personal" }
  | {
      kind: "member";
      publicRead: boolean;
      publicWrite: boolean;
      /** OAuth client IDs that may read; any app may when unset. */
      allowedApps?: string[];
      publishPolicy: boolean;
      publishMembers: boolean;
    }
  | { kind: "managed"; managingApp: string; publishPolicy: boolean }
  | { kind: "unknown"; type: string };

export type NewSpacePolicy = Exclude<SpacePolicy, { kind: "unknown" }>;

export interface SpaceInfo {
  uri: string;
  policy: SpacePolicy;
}

interface CreateSpaceOptions {
  type: string;
  skey?: string;
  policy: NewSpacePolicy;
}

export interface CreateSpaceResult {
  uri: string;
}

export interface SpaceMember {
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

interface ListSpaceMembersResult {
  cursor?: string;
  members: SpaceMember[];
}

export interface GetSpaceRecordResult {
  uri: string;
  cid: string;
  value: JSONType;
  /** Present on records fetched with a space credential, for verifySpaceRecord. */
  mac?: SpaceRecordMac;
}

interface SpaceRecordMac {
  /** The `Atproto-Space-Record` response header, which the MAC covers. */
  covered: string | null;
  signatureInput: string | null;
  signature: string | null;
  /** The signature parameters the MAC was requested with. */
  signatureParams: string;
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

  const exchangeUrl = new URL("/xrpc/com.atproto.space.authorizeSpaceSync", host);
  const response = await fetch(exchangeUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      space,
      credentialKey: await key.exportPublicKey("did"),
      delegationToken: delegation.token,
    }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    const message = getErrorMessage(data, response.status);
    if (isObject(data) && data.error === "AppNotAuthorized") {
      throw new Error(`${message}. This Space requires an approved application.`);
    }
    // Authorities may answer SpaceNotFound or the generic NotAuthorized for accounts they
    // don't authorize, so as not to reveal the space.
    if (
      isObject(data) &&
      (data.error === "SpaceNotFound" ||
        data.error === "AccountNotAuthorized" ||
        data.error === "NotAuthorized")
    ) {
      throw new Error("This Space doesn't exist, or you don't have access to it");
    }
    if (isObject(data) && data.error === "SpaceDeleted") {
      throw new Error("This Space has been deleted");
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

const POLICY_TYPES = {
  personal: "com.atproto.personalspace.policy",
  member: "com.atproto.memberspace.policy",
  managed: "com.atproto.managedspace.policy",
} as const;

const parseSpacePolicy = (value: unknown): SpacePolicy => {
  if (!isObject(value) || typeof value.$type !== "string") {
    throw new Error("The Space authority returned an invalid policy");
  }

  switch (value.$type) {
    case POLICY_TYPES.personal:
      return { kind: "personal" };
    case POLICY_TYPES.member: {
      const allowedApps = value.allowedApps;
      if (
        allowedApps !== undefined &&
        (!Array.isArray(allowedApps) || !allowedApps.every((app) => typeof app === "string"))
      ) {
        throw new Error("The Space authority returned an invalid app allow list");
      }
      return {
        kind: "member",
        publicRead: value.publicRead === true,
        publicWrite: value.publicWrite === true,
        allowedApps,
        publishPolicy: value.publishPolicy === true,
        publishMembers: value.publishMembers === true,
      };
    }
    case POLICY_TYPES.managed:
      if (typeof value.managingApp !== "string") {
        throw new Error("The Space authority returned an invalid managing app");
      }
      return {
        kind: "managed",
        managingApp: value.managingApp,
        publishPolicy: value.publishPolicy === true,
      };
    default:
      return { kind: "unknown", type: value.$type };
  }
};

const encodeSpacePolicy = (policy: NewSpacePolicy) => {
  switch (policy.kind) {
    case "personal":
      return { $type: POLICY_TYPES.personal };
    case "member":
      return {
        $type: POLICY_TYPES.member,
        publicRead: policy.publicRead,
        publicWrite: policy.publicWrite,
        // Omitted rather than empty: an unset list lets any app read.
        ...(policy.allowedApps ? { allowedApps: policy.allowedApps } : {}),
        publishPolicy: policy.publishPolicy,
        publishMembers: policy.publishMembers,
      };
    case "managed":
      return {
        $type: POLICY_TYPES.managed,
        managingApp: policy.managingApp,
        publishPolicy: policy.publishPolicy,
      };
  }
};

const assertSpaceAuthority = (auth: OAuthUserAgent, space: string, action: string) => {
  const parsed = parseSpaceUri(space);
  if (!parsed) throw new Error("Invalid Space reference");
  if (parsed.authority !== auth.sub) {
    throw new Error(`Only the Space authority can ${action} this Space`);
  }
};

export const createSpace = async (
  auth: OAuthUserAgent,
  options: CreateSpaceOptions,
): Promise<CreateSpaceResult> => {
  const data = await oauthProcedure(auth, "com.atproto.space.createSpace", {
    spaceType: options.type,
    skey: options.skey,
    policy: encodeSpacePolicy(options.policy),
  });

  if (!isObject(data) || typeof data.space !== "string" || !parseSpaceUri(data.space)) {
    throw new Error("The PDS returned an invalid Space creation response");
  }

  clearCredentialsForSpace(data.space);
  return { uri: data.space };
};

/** Replaces the space's policy as a whole; a different kind discards the old one's member list. */
export const updateSpace = async (
  auth: OAuthUserAgent,
  space: string,
  policy: NewSpacePolicy,
): Promise<void> => {
  assertSpaceAuthority(auth, space, "configure");

  await oauthProcedure(auth, "com.atproto.space.updateSpace", {
    space,
    policy: encodeSpacePolicy(policy),
  });
  clearCredentialsForSpace(space);
};

export const deleteSpace = async (auth: OAuthUserAgent, space: string): Promise<void> => {
  assertSpaceAuthority(auth, space, "delete");

  await oauthProcedure(auth, "com.atproto.space.deleteSpace", { space });
  clearCredentialsForSpace(space);
};

export const putSpaceMember = async (
  auth: OAuthUserAgent,
  space: string,
  member: SpaceMember,
): Promise<void> => {
  assertSpaceAuthority(auth, space, "manage members of");
  await oauthProcedure(auth, "com.atproto.memberspace.putMembers", {
    space,
    members: [{ did: member.did, read: member.read, write: member.write }],
  });
  clearCredentialsForSpace(space);
};

export const removeSpaceMember = async (
  auth: OAuthUserAgent,
  space: string,
  did: string,
): Promise<void> => {
  assertSpaceAuthority(auth, space, "remove members from");
  await oauthProcedure(auth, "com.atproto.memberspace.removeMembers", { space, dids: [did] });
  clearCredentialsForSpace(space);
};

/**
 * A space's policy. Only its owner can ask for it directly; anyone else sees it only if the owner
 * publishes it, as a `com.atproto.space.policy` record in their own repo in the space.
 */
export const getSpaceInfo = async (
  auth: OAuthUserAgent,
  space: string,
): Promise<SpaceInfo | undefined> => {
  const parsed = parseSpaceUri(space);
  if (!parsed) throw new Error("Invalid Space reference");

  let policy: unknown;
  try {
    if (parsed.authority === auth.sub) {
      const data = await oauthQuery(auth, "com.atproto.space.getSpace", { space });
      if (!isObject(data) || data.space !== space) {
        throw new Error("The Space authority returned an invalid Space response");
      }
      policy = data.policy;
    } else {
      const record = await getSpaceRecord(
        auth,
        space,
        parsed.authority,
        "com.atproto.space.policy",
        "self",
      );
      policy = isObject(record.value) ? record.value.policy : undefined;
    }
  } catch (err) {
    if (
      err instanceof SpaceRequestError &&
      (err.status === 404 ||
        err.code === "SpaceNotFound" ||
        err.code === "RecordNotFound" ||
        err.code === "XRPCNotSupported" ||
        err.code === "MethodNotImplemented")
    ) {
      return undefined;
    }
    throw err;
  }

  return { uri: space, policy: parseSpacePolicy(policy) };
};

export const listSpaceMembers = async (
  auth: OAuthUserAgent,
  space: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<ListSpaceMembersResult> => {
  const limit = options.limit ?? 100;
  const data = await oauthQuery(auth, "com.atproto.memberspace.listMembers", {
    space,
    cursor: options.cursor,
    limit,
  });

  if (!isObject(data) || !Array.isArray(data.members)) {
    throw new Error("The PDS returned an invalid member list");
  }

  return {
    // The alpha server can return the final member as a cursor even when the
    // page is already exhausted.
    cursor:
      data.members.length >= limit && typeof data.cursor === "string" ? data.cursor : undefined,
    members: data.members.flatMap((member): SpaceMember[] => {
      if (
        !isObject(member) ||
        typeof member.did !== "string" ||
        typeof member.read !== "boolean" ||
        typeof member.write !== "boolean"
      ) {
        throw new Error("The PDS returned invalid member access");
      }
      return [{ did: member.did, read: member.read, write: member.write }];
    }),
  };
};

/**
 * Parses a space reference, `at:space/{authority}/{type}/{skey}`. The form used earlier in the
 * alpha, `at://{authority}/space/{type}/{skey}`, is read too, since older hosts still return it.
 */
export const parseSpaceUri = (uri: string): ParsedSpaceUri | undefined => {
  const match =
    /^at:space\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri) ??
    /^at:\/\/([^/]+)\/space\/([^/]+)\/([^/]+)$/.exec(uri);
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
    spaces: data.spaces.flatMap((entry): SpaceView[] =>
      isObject(entry) && typeof entry.space === "string" ? [{ uri: entry.space }] : [],
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
    "com.atproto.space.listWriters",
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
    // Entries without a repoRev are repos removed from the writer set, which are left out.
    repos: data.repos.flatMap((entry): SpaceRepo[] => {
      if (!isObject(entry) || typeof entry.repo !== "string" || typeof entry.repoRev !== "string") {
        return [];
      }
      return [{ did: entry.repo, rev: entry.repoRev }];
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
  options: { cursor?: string; limit?: number } = {},
): Promise<ListSpaceBlobsResult> => {
  const pds = await resolveRepoHost(repo);
  const data = await credentialQuery(auth, space, repo, pds, "com.atproto.space.listBlobs", {
    space,
    repo,
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
  const signatureParams = recordMacParams(keyShare.did);
  const { data, headers } = await credentialRequest(
    auth,
    space,
    repo,
    pds,
    "com.atproto.space.getRecord",
    { space, repo, collection, rkey },
    { "accept-signature": `mac=${signatureParams}` },
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
    mac: {
      covered: headers.get(RECORD_MAC_PROFILE),
      signatureInput: headers.get("signature-input"),
      signature: headers.get("signature"),
      signatureParams,
      keyShare,
    },
  };
};

// Space records read with a credential are authenticated by a MAC: an HTTP message signature
// (RFC 9421) using hmac-sha256, requested with Accept-Signature. Its key is a secret shared
// between us and the author's repo host, exported from HPKE (RFC 9180) in base mode with
// DHKEM(P-256, HKDF-SHA256): an ephemeral key of ours against the author's #atproto_kem key.

const RECORD_MAC_PROFILE = "atproto-space-record";

/** The parameters of the MAC we ask for, which the host signs under as given. */
const recordMacParams = (keyShare: string) =>
  `("${RECORD_MAC_PROFILE}";sf);keyid="${keyShare}";tag="${RECORD_MAC_PROFILE}"`;

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

// HPKE labels every HKDF input with a version and the IDs of the algorithms in use: 0x0010 is
// DHKEM(P-256, HKDF-SHA256), 0x0001 is HKDF-SHA256, and 0xffff is the export-only AEAD.
const HPKE_VERSION = utf8("HPKE-v1");
const KEM_ID = concatBytes([utf8("KEM"), uint16be(0x0010)]);
const SUITE_ID = concatBytes([utf8("HPKE"), uint16be(0x0010), uint16be(0x0001), uint16be(0xffff)]);
const HPKE_INFO = utf8("atproto-mac");
const EMPTY = new Uint8Array(0);
const HASH_LENGTH = 32;

const hmacSha256 = async (key: Uint8Array, data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> => {
  const imported = await crypto.subtle.importKey(
    "raw",
    // HMAC pads its key with zeros, so this stands in for an empty one, which can't be imported.
    key.length ? new Uint8Array(key) : new Uint8Array(HASH_LENGTH),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, new Uint8Array(data)));
};

const labeledExtract = (id: Uint8Array, salt: Uint8Array, label: string, ikm: Uint8Array) =>
  hmacSha256(salt, concatBytes([HPKE_VERSION, id, utf8(label), ikm]));

/** Always expands to one hash's length, which a single HKDF block covers. */
const labeledExpand = (id: Uint8Array, prk: Uint8Array, label: string, info: Uint8Array) =>
  hmacSha256(
    prk,
    concatBytes([uint16be(HASH_LENGTH), HPKE_VERSION, id, utf8(label), info, new Uint8Array([1])]),
  );

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

/** HPKE's SetupBaseS followed by an export with an empty exporter context. */
const deriveSharedSecret = async (keyShare: KeyShare, kemKey: KemKey) => {
  const dh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: kemKey.key }, keyShare.privateKey, 256),
  );

  // The KEM's secret, from the ECDH result and both public keys.
  const eaePrk = await labeledExtract(KEM_ID, EMPTY, "eae_prk", dh);
  const kemSecret = await labeledExpand(
    KEM_ID,
    eaePrk,
    "shared_secret",
    concatBytes([keyShare.publicKey, kemKey.publicKey]),
  );

  // The key schedule, in base mode with no pre-shared key.
  const pskIdHash = await labeledExtract(SUITE_ID, EMPTY, "psk_id_hash", EMPTY);
  const infoHash = await labeledExtract(SUITE_ID, EMPTY, "info_hash", HPKE_INFO);
  const context = concatBytes([new Uint8Array([0]), pskIdHash, infoHash]);
  const secret = await labeledExtract(SUITE_ID, kemSecret, "secret", EMPTY);
  const exporterSecret = await labeledExpand(SUITE_ID, secret, "exp", context);

  return labeledExpand(SUITE_ID, exporterSecret, "sec", EMPTY);
};

/** Splits a structured field dictionary into its members, keeping each value as written. */
const parseDictionaryMembers = (field: string): Map<string, string> => {
  const members = new Map<string, string>();
  let start = 0;
  let quoted = false;
  for (let index = 0; index <= field.length; index++) {
    const char = field[index];
    if (quoted && char === "\\") index++;
    else if (char === '"') quoted = !quoted;
    else if (index === field.length || (char === "," && !quoted)) {
      const member = field.slice(start, index).trim();
      const separator = member.indexOf("=");
      if (separator <= 0) throw new Error("The PDS returned a malformed MAC");
      members.set(member.slice(0, separator), member.slice(separator + 1));
      start = index + 1;
    }
  }
  if (quoted) throw new Error("The PDS returned a malformed MAC");
  return members;
};

/**
 * Checks the MAC on a record: that the `Atproto-Space-Record` header names this record, and
 * that the signature under the parameters we asked for covers that header.
 */
const checkRecordMac = async (record: GetSpaceRecordResult, kemKey: KemKey) => {
  if (!record.mac) throw new Error("The record was not fetched with a MAC");
  const { covered, signatureInput, signature, signatureParams, keyShare } = record.mac;
  if (!covered || !signatureInput || !signature) {
    throw new Error("The PDS did not return a record MAC");
  }

  const fields = parseDictionaryMembers(covered);
  if (
    fields.get("uri") !== JSON.stringify(record.uri) ||
    fields.get("cid") !== JSON.stringify(record.cid)
  ) {
    throw new Error("The record does not match its MAC");
  }

  // Labels carry no meaning, so the MAC is the signature made under our parameters.
  const label = [...parseDictionaryMembers(signatureInput)].find(
    ([, params]) => params === signatureParams,
  )?.[0];
  const mac = /^:([A-Za-z0-9+/]*)=*:$/.exec(
    (label && parseDictionaryMembers(signature).get(label)) ?? "",
  );
  if (!mac) throw new Error("The PDS did not return a record MAC");

  const key = await crypto.subtle.importKey(
    "raw",
    await deriveSharedSecret(keyShare, kemKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  // The `sf` flag covers the header as re-serialized from its parsed form.
  const serialized = [...fields].map(([name, value]) => `${name}=${value}`).join(", ");
  const base = [
    `"${RECORD_MAC_PROFILE}";sf: ${serialized}`,
    `"@signature-params": ${signatureParams}`,
  ].join("\n");
  return crypto.subtle.verify("HMAC", key, fromBase64(mac[1]), utf8(base));
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
