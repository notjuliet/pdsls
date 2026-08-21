import type { OAuthUserAgent } from "@atcute/oauth-browser-client";

import type { JSONType } from "../components/json";

export interface SpaceView {
  uri: string;
}

export interface SpaceRecord {
  collection: string;
  rkey: string;
  cid: string;
  value?: JSONType;
}

export interface ListSpacesResult {
  cursor?: string;
  spaces: SpaceView[];
}

export interface ListSpaceRecordsResult {
  cursor?: string;
  records: SpaceRecord[];
}

export interface GetSpaceRecordResult {
  uri: string;
  cid: string;
  value: JSONType;
}

export interface ParsedSpaceUri {
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

const query = async (
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

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }

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
  const data = await query(auth, "com.atproto.space.listSpaces", {
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
  const data = await query(auth, "com.atproto.space.listRecords", {
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
  const data = await query(auth, "com.atproto.space.getRecord", {
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
  const search = new URLSearchParams({ space, repo, cid });
  const response = await auth.handle(`/xrpc/com.atproto.space.getBlob?${search}`, {
    headers: { accept: "*/*" },
  });

  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = undefined;
    }
    throw new Error(getErrorMessage(data, response.status));
  }

  return response.blob();
};
