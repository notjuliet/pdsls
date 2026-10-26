import { Did } from "@atcute/lexicons";
import { useNavigate, useParams } from "@solidjs/router";
import { JSX } from "solid-js";

import { Login } from "../auth/login.jsx";
import { lastVisitedPage } from "../auth/return-to.js";
import { useOAuthScopeFlow } from "../auth/scope-flow.js";
import { ScopeSelector } from "../auth/scope-selector.jsx";
import { parseScopeString } from "../auth/scope-utils.js";
import { loadSessionsFromStorage } from "../auth/session-manager.js";
import { sessions } from "../auth/state.js";

const AccountPage = (props: { children: JSX.Element }) => (
  <div class="w-full max-w-sm px-2 py-1">{props.children}</div>
);

export const AccountLoginView = () => {
  document.title = "Add account - PDSls";

  return (
    <AccountPage>
      <Login />
    </AccountPage>
  );
};

export const AccountPermissionsView = () => {
  const params = useParams<{ did: string }>();
  const did = params.did as Did;
  const storedSession = loadSessionsFromStorage()?.[did];
  // The handle can arrive after the page opens, so it's read reactively.
  const handle = () => sessions[did]?.handle ?? storedSession?.handle;
  const navigate = useNavigate();
  const scopeFlow = useOAuthScopeFlow();
  scopeFlow.initiateWithRedirect(did);
  document.title = "Edit permissions - PDSls";

  return (
    <AccountPage>
      <div class="mb-4">
        <h1 class="text-lg font-semibold">Edit permissions</h1>
        <p class="truncate text-sm text-neutral-600 dark:text-neutral-400">{handle() ?? did}</p>
      </div>
      <ScopeSelector
        confirmLabel="Save permissions"
        initialScopes={parseScopeString(
          sessions[did]?.grantedScopes ?? storedSession?.grantedScopes ?? "",
        )}
        onConfirm={scopeFlow.complete}
        onCancel={() => navigate(lastVisitedPage() ?? "/")}
        cancelLabel="Cancel"
      />
    </AccountPage>
  );
};
