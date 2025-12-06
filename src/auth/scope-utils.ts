import { agent, sessions } from "./state";

export const GRANULAR_SCOPES = [
  {
    id: "create",
    scope: "repo:*?action=create",
    label: "Create records",
  },
  {
    id: "update",
    scope: "repo:*?action=update",
    label: "Update records",
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
];

export const BASE_SCOPES = ["atproto"];

export const buildScopeString = (selected: Set<string>): string => {
  const granular = GRANULAR_SCOPES.filter((s) => selected.has(s.id)).map((s) => s.scope);
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

export const hasScope = (grantedScopes: string | undefined, scopeId: string): boolean => {
  if (!grantedScopes) return false;
  return grantedScopes.split(",").includes(scopeId);
};

export const hasUserScope = (scopeId: string): boolean => {
  if (!agent()) return false;
  const grantedScopes = sessions[agent()!.sub]?.grantedScopes;
  if (!grantedScopes) return true;
  return hasScope(grantedScopes, scopeId);
};
