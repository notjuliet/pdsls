import { Did } from "@atcute/lexicons";
import { useParams } from "@solidjs/router";
import { JSX } from "solid-js";

import { Login } from "../auth/login.jsx";
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
  const account = sessions[did]?.handle ?? storedSession?.handle ?? did;
  const scopeFlow = useOAuthScopeFlow();
  scopeFlow.initiateWithRedirect(did);
  document.title = "Edit permissions - PDSls";

  return (
    <AccountPage>
      <div class="mb-1">
        <h1 class="text-lg font-semibold">Edit permissions</h1>
        <p class="text-sm text-neutral-600 dark:text-neutral-400">{account}</p>
      </div>
      <ScopeSelector
        confirmLabel="Save permissions"
        initialScopes={parseScopeString(
          sessions[did]?.grantedScopes ?? storedSession?.grantedScopes ?? "",
        )}
        onConfirm={scopeFlow.complete}
      />
    </AccountPage>
  );
};
