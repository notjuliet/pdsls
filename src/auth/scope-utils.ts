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

export const parseScopeString = (scopeString: string): Set<string> => {
  const selected = new Set<string>();
  if (!scopeString) return selected;

  for (const scope of GRANULAR_SCOPES) {
    if (scopeString.includes(scope.scope)) {
      selected.add(scope.id);
    }
  }

  return selected;
};

export const hasScope = (scopeString: string | undefined, scopeId: string): boolean => {
  if (!scopeString) return false;
  const scope = GRANULAR_SCOPES.find((s) => s.id === scopeId);
  return scope ? scopeString.includes(scope.scope) : false;
};

export const hasUserScope = (scopeId: string): boolean => {
  if (!agent()) return false;
  const grantedScopes = sessions[agent()!.sub]?.grantedScopes;
  if (!grantedScopes) return true;
  return hasScope(grantedScopes, scopeId);
};
