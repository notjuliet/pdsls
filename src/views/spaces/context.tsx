import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { type Accessor, createContext, type Setter, useContext } from "solid-js";

export const SpacesAuthContext = createContext<Accessor<OAuthUserAgent>>();

export const useSpacesAuth = () => {
  const auth = useContext(SpacesAuthContext);
  if (!auth) throw new Error("Spaces auth context is missing");
  return auth;
};

type SpaceRecordMetadata = {
  cid: Accessor<string | undefined>;
  setCid: Setter<string | undefined>;
};

export const SpaceRecordMetadataContext = createContext<SpaceRecordMetadata>();

export const useSpaceRecordMetadata = () => {
  const metadata = useContext(SpaceRecordMetadataContext);
  if (!metadata) throw new Error("Space record metadata context is missing");
  return metadata;
};

export const makeSpaceRef = (authority: string, type: string, skey: string) =>
  `at://${authority}/space/${type}/${skey}`;

export const makeSpacePath = (authority: string, type: string, skey: string) =>
  `/spaces/${authority}/${type}/${skey}`;

export const makeSpaceCollectionPath = (
  authority: string,
  type: string,
  skey: string,
  collection: string,
) => `${makeSpacePath(authority, type, skey)}/${collection}`;

export const makeSpaceRecordPath = (
  authority: string,
  type: string,
  skey: string,
  collection: string,
  rkey: string,
) => `${makeSpaceCollectionPath(authority, type, skey, collection)}/${rkey}`;
