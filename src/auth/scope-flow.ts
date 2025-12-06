import { isDid, isHandle } from "@atcute/lexicons/syntax";
import { createAuthorizationUrl } from "@atcute/oauth-browser-client";
import { createSignal } from "solid-js";

interface UseOAuthScopeFlowOptions {
  onError?: (error: unknown) => void;
  onRedirecting?: () => void;
  beforeRedirect?: (account: string) => Promise<void>;
}

export const useOAuthScopeFlow = (options: UseOAuthScopeFlowOptions = {}) => {
  const [showScopeSelector, setShowScopeSelector] = createSignal(false);
  const [pendingAccount, setPendingAccount] = createSignal("");
  const [shouldForceRedirect, setShouldForceRedirect] = createSignal(false);

  const initiate = (account: string) => {
    if (!account) return;
    setPendingAccount(account);
    setShouldForceRedirect(false);
    setShowScopeSelector(true);
  };

  const initiateWithRedirect = (account: string) => {
    if (!account) return;
    setPendingAccount(account);
    setShouldForceRedirect(true);
    setShowScopeSelector(true);
  };

  const complete = async (scopeString: string, scopeIds: string) => {
    try {
      const account = pendingAccount();

      if (options.beforeRedirect && !shouldForceRedirect()) {
        try {
          await options.beforeRedirect(account);
          setShowScopeSelector(false);
          return;
        } catch {}
      }

      localStorage.setItem("pendingScopes", scopeIds);

      options.onRedirecting?.();

      const authUrl = await createAuthorizationUrl({
        scope: scopeString,
        target:
          isHandle(account) || isDid(account) ?
            { type: "account", identifier: account }
          : { type: "pds", serviceUrl: account },
      });

      await new Promise((resolve) => setTimeout(resolve, 250));
      location.assign(authUrl);
    } catch (e) {
      console.error(e);
      options.onError?.(e);
      setShowScopeSelector(false);
    }
  };

  const cancel = () => {
    setShowScopeSelector(false);
    setPendingAccount("");
    setShouldForceRedirect(false);
  };

  return {
    showScopeSelector,
    pendingAccount,
    initiate,
    initiateWithRedirect,
    complete,
    cancel,
  };
};
