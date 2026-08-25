import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { type Accessor, createContext, useContext } from "solid-js";

export const SpacesAuthContext = createContext<Accessor<OAuthUserAgent>>();

export const useSpacesAuth = () => {
  const auth = useContext(SpacesAuthContext);
  if (!auth) throw new Error("Spaces auth context is missing");
  return auth;
};

type SpaceRecordsState = {
  recordsVersion: Accessor<number>;
  invalidateRecords: () => void;
};

export const SpaceRecordsContext = createContext<SpaceRecordsState>();

export const useSpaceRecords = () => {
  const state = useContext(SpaceRecordsContext);
  if (!state) throw new Error("Space records context is missing");
  return state;
};

export const makeSpaceRef = (authority: string, type: string, skey: string) =>
  `at://${authority}/space/${type}/${skey}`;

export const makeSpacePath = (authority: string, type: string, skey: string) =>
  `/spaces/${authority}/space/${type}/${skey}`;

export const makeSpaceRepoPath = (authority: string, type: string, skey: string, repo: string) =>
  `${makeSpacePath(authority, type, skey)}/${repo}`;

export const makeSpaceCollectionPath = (
  authority: string,
  type: string,
  skey: string,
  repo: string,
  collection: string,
) => `${makeSpaceRepoPath(authority, type, skey, repo)}/${collection}`;

export const makeSpaceRecordPath = (
  authority: string,
  type: string,
  skey: string,
  repo: string,
  collection: string,
  rkey: string,
) => `${makeSpaceCollectionPath(authority, type, skey, repo, collection)}/${rkey}`;

export const spaceAtUriToPath = (uri: string) => {
  const spaceUri = /^at:\/\/[^/]+\/space\/[^/]+\/[^/]+(?:\/[^/]+(?:\/[^/]+(?:\/[^/]+)?)?)?$/.test(
    uri,
  );
  return spaceUri ? `/spaces/${uri.slice("at://".length)}` : undefined;
};
