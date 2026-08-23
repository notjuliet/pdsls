import { Did } from "@atcute/lexicons";

import { agent, sessions } from "./state";

export const SPACE_READ_SCOPE_ID = "space-read" as const;
export const SPACE_READ_SCOPE = "space:*?authority=*&action=read";
export const SPACE_MANAGE_RECORDS_SCOPE_ID = "space-manage-records" as const;
export const SPACE_MANAGE_RECORDS_SCOPE =
  "space:*?authority=*&collection=*&action=create&action=update&action=delete";
export const SPACE_MANAGE_SPACES_SCOPE_ID = "space-manage-spaces" as const;
export const SPACE_MANAGE_SPACES_SCOPE = "space:*?manage=create&manage=update&manage=delete";

export const GRANULAR_SCOPES = [
  {
    id: "create",
    scope: "repo:*?action=create",
    label: "Create and edit records",
  },
  {
    id: "update",
    scope: "repo:*?action=update",
    label: "Create and edit records",
  },
  {
    id: "delete",
    scope: "repo:*?action=delete",
    label: "Delete records",
  },
  {
    id: "blob",
    scope: "blob:*/*",
    label: "Upload blobs",
  },
  {
    id: SPACE_READ_SCOPE_ID,
    scope: SPACE_READ_SCOPE,
    label: "View non-public records",
    alpha: true,
  },
  {
    id: SPACE_MANAGE_RECORDS_SCOPE_ID,
    scope: SPACE_MANAGE_RECORDS_SCOPE,
    label: "Write non-public records",
    alpha: true,
  },
  {
    id: SPACE_MANAGE_SPACES_SCOPE_ID,
    scope: SPACE_MANAGE_SPACES_SCOPE,
    label: "Manage Spaces",
    alpha: true,
  },
] as const;

export type ScopeId = (typeof GRANULAR_SCOPES)[number]["id"];

const BASE_SCOPES = ["atproto"];

export const buildScopeString = (selected: Set<string>): string => {
  const needsSpaceReadScope =
    selected.has(SPACE_MANAGE_RECORDS_SCOPE_ID) || selected.has(SPACE_MANAGE_SPACES_SCOPE_ID);
  const needsBlobScope =
    selected.has("create") || selected.has("update") || selected.has(SPACE_MANAGE_RECORDS_SCOPE_ID);
  const granular = GRANULAR_SCOPES.filter(({ id }) => {
    if (id === "blob") return needsBlobScope;
    if (id === SPACE_READ_SCOPE_ID) return needsSpaceReadScope || selected.has(id);
    return selected.has(id);
  }).map(({ scope }) => scope);
  return [...BASE_SCOPES, ...granular].join(" ");
};

export const scopeIdsToString = (scopeIds: Set<string>): string => {
  return ["atproto", ...Array.from(scopeIds)].join(",");
};

export const parseScopeString = (scopeIdsString: string): Set<string> => {
  if (!scopeIdsString) return new Set();
  const ids = scopeIdsString.split(",").filter(Boolean);
  return new Set(ids.filter((id) => id !== "atproto"));
};

const normalizeOAuthScope = (scope: string, did?: Did): string => {
  const separator = scope.indexOf("?");
  const name = separator === -1 ? scope : scope.slice(0, separator);
  const params = Array.from(
    new URLSearchParams(separator === -1 ? "" : scope.slice(separator + 1)),
    ([key, value]) => [key, key === "authority" && value === "self" && did ? did : value] as const,
  );

  if (name.startsWith("space:")) {
    if (!params.some(([key]) => key === "authority")) {
      params.push(["authority", did ?? "self"]);
    }
    if (!params.some(([key]) => key === "skey")) params.push(["skey", "*"]);
  }

  params.sort(([keyA, valueA], [keyB, valueB]) =>
    keyA === keyB ? valueA.localeCompare(valueB) : keyA.localeCompare(keyB),
  );
  return JSON.stringify([name, params]);
};

const oauthScopeIsGranted = (scopeString: string, requested: string, did?: Did): boolean => {
  const normalized = normalizeOAuthScope(requested, did);
  return scopeString
    .split(" ")
    .filter(Boolean)
    .some((granted) => normalizeOAuthScope(granted, did) === normalized);
};

export const oauthScopeStringToIds = (scopeString: string, did?: Did): Set<string> => {
  return new Set(
    GRANULAR_SCOPES.filter(({ scope }) => oauthScopeIsGranted(scopeString, scope, did)).map(
      ({ id }) => id,
    ),
  );
};

const hasScope = (grantedScopes: string | undefined, scopeId: string): boolean => {
  if (!grantedScopes) return false;
  return grantedScopes.split(",").includes(scopeId);
};

export const hasUserScope = (scopeId: ScopeId): boolean => {
  const currentAgent = agent();
  if (!currentAgent) return false;

  return hasAccountScope(currentAgent.sub, scopeId);
};

export const hasAccountScope = (did: Did, scopeId: ScopeId): boolean => {
  const currentAgent = agent();

  const configuredScope = GRANULAR_SCOPES.find(({ id }) => id === scopeId)?.scope;
  if (currentAgent?.sub === did && configuredScope && currentAgent.session.token.scope) {
    return oauthScopeIsGranted(currentAgent.session.token.scope, configuredScope, did);
  }

  const grantedScopes = sessions[did]?.grantedScopes;
  if (!grantedScopes) return true;
  return hasScope(grantedScopes, scopeId);
};
