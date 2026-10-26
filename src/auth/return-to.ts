const RETURN_KEY = "signInReturnTo";

/** The last page visited outside the account pages, where signing in should land you again. */
let lastPage: string | undefined;
/** The OAuth callback's params, taken off the URL before the router starts. */
let callbackParams: URLSearchParams | undefined;

/** Records a visited page; the account pages don't count. */
export const rememberPage = (path: string) => {
  if (!path.startsWith("/account/")) lastPage = path;
};

export const lastVisitedPage = () => lastPage;

/** Saves the page to come back to, just before leaving for the authorization server. */
export const saveReturnPage = () => {
  try {
    if (lastPage) sessionStorage.setItem(RETURN_KEY, lastPage);
    else sessionStorage.removeItem(RETURN_KEY);
  } catch {}
};

/** Only a path on this site, so a stored value can't send you elsewhere. */
const isLocalPath = (value: unknown): value is string =>
  typeof value === "string" && /^\/(?![/\\])/.test(value);

/**
 * Runs before the app renders: on the OAuth callback, keeps its params for finishing sign-in
 * and swaps the URL for the page you signed in from, so that page loads straight away.
 */
export const restoreAfterSignIn = () => {
  const params = new URLSearchParams(decodeURIComponent(location.hash.slice(1)));
  if (!params.has("state") || !(params.has("code") || params.has("error"))) return;
  callbackParams = params;

  let returnTo: string | null = null;
  try {
    returnTo = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
  } catch {}
  history.replaceState(
    null,
    "",
    isLocalPath(returnTo) ? returnTo : location.pathname + location.search,
  );
};

/** The callback params, once: finishing sign-in consumes them. */
export const takeCallbackParams = () => {
  const params = callbackParams;
  callbackParams = undefined;
  return params;
};
