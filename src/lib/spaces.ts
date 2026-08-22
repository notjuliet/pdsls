import { getAtprotoServiceEndpoint, getPdsEndpoint } from "@atcute/identity";
import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { createDpopFetch, generateDpopKey } from "@atcute/oauth-crypto";

import type { JSONType } from "../components/json";
import { getPDS, resolveDidDoc } from "./api";

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

interface ListSpacesResult {
  cursor?: string;
  spaces: SpaceView[];
}

interface ListSpaceRecordsResult {
  cursor?: string;
  records: SpaceRecord[];
}

interface ListSpaceReposResult {
  cursor?: string;
  repos: SpaceRepo[];
}

export interface GetSpaceRecordResult {
  uri: string;
  cid: string;
  value: JSONType;
}

interface ParsedSpaceUri {
  authority: string;
  type: string;
  skey: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const getErrorMessage = (data: unknown, status: number) => {
  if (isObject(data)) {
    if (typeof data.message === "string" && data.message) return data.message;
    if (typeof data.error === "string" && data.error) return data.error;
  }
  return `Spaces request failed with HTTP ${status}`;
};

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

  if (!response.ok) throw new Error(getErrorMessage(data, response.status));
  return data;
};

interface SpaceCredentialSession {
  credential: string;
  expiresAt: number;
  fetch: typeof fetch;
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
    const endpoint =
      getAtprotoServiceEndpoint(document, { id: "#atproto_space_host" }) ??
      getPdsEndpoint(document);
    if (!endpoint) throw new Error("The Space authority does not publish a Space host");
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

const acquireSpaceCredential = async (
  auth: OAuthUserAgent,
  space: string,
): Promise<SpaceCredentialSession> => {
  const [host, key] = await Promise.all([resolveSpaceHost(space), generateDpopKey(["ES256"])]);

  const delegation = await oauthQuery(auth, "com.atproto.space.getDelegationToken", { space });
  if (!isObject(delegation) || typeof delegation.token !== "string") {
    throw new Error("The PDS returned an invalid Space delegation token");
  }

  const nonceValues = new Map<string, string>();
  const dpopFetch = createDpopFetch({
    key,
    nonces: {
      get: (origin) => nonceValues.get(origin),
      set: (origin, nonce) => {
        nonceValues.set(origin, nonce);
      },
    },
  });
  const exchangeUrl = new URL("/xrpc/com.atproto.space.getSpaceCredential", host);
  const response = await dpopFetch(exchangeUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${delegation.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ space }),
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
    fetch: dpopFetch,
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

const credentialQuery = async (
  auth: OAuthUserAgent,
  space: string,
  service: string,
  method: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<unknown> => {
  const session = await getSpaceCredential(auth, space);
  const url = new URL(`/xrpc/${method}`, service);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await session.fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `DPoP ${session.credential}`,
    },
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(getErrorMessage(data, response.status));
  return data;
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
  const host = await resolveSpaceHost(space);
  const data = await credentialQuery(auth, space, host, "com.atproto.space.listRepos", {
    space,
    cursor: options.cursor,
    limit: options.limit ?? 1000,
  });

  if (!isObject(data) || !Array.isArray(data.repos)) {
    throw new Error("The Space authority returned an invalid writer list");
  }

  return {
    cursor: typeof data.cursor === "string" ? data.cursor : undefined,
    repos: data.repos.flatMap((repo): SpaceRepo[] => {
      if (!isObject(repo) || typeof repo.did !== "string" || typeof repo.rev !== "string") {
        return [];
      }
      return [{ did: repo.did, rev: repo.rev }];
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
  const data = await credentialQuery(auth, space, pds, "com.atproto.space.listRecords", {
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

export const getSpaceRecord = async (
  auth: OAuthUserAgent,
  space: string,
  repo: string,
  collection: string,
  rkey: string,
): Promise<GetSpaceRecordResult> => {
  const pds = await resolveRepoHost(repo);
  const data = await credentialQuery(auth, space, pds, "com.atproto.space.getRecord", {
    space,
    repo,
    collection,
    rkey,
  });

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
  };
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
  const response = await session.fetch(url, {
    headers: {
      accept: "*/*",
      authorization: `DPoP ${session.credential}`,
    },
  });

  if (!response.ok) {
    const data = await readJson(response);
    throw new Error(getErrorMessage(data, response.status));
  }

  return response.blob();
};
