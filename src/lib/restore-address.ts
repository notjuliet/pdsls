/** Characters a path segment may hold as they are, which encodeURIComponent escapes anyway. */
const READABLE = /%(3A|40|24|26|2B|2C|3B|3D)/gi;

const readable = (segment: string) => {
  try {
    return encodeURIComponent(decodeURIComponent(segment)).replace(READABLE, (escaped) =>
      decodeURIComponent(escaped),
    );
  } catch {
    return segment;
  }
};

/** The address as the app writes it, from the form the host's static file server redirects to. */
export const readableAddress = (pathname: string) =>
  pathname
    .split("/")
    .map(readable)
    .join("/")
    .replace(/^\/at:\/(?!\/)/, "/at://");

/**
 * Runs before the app renders. Cloudflare's static file server redirects /at://did:plc:… to
 * /at%3A/did%3Aplc%3A… before serving the page, so this puts the readable address back.
 */
export const restoreAddress = () => {
  const pathname = readableAddress(location.pathname);
  if (pathname === location.pathname) return;
  history.replaceState(history.state, "", pathname + location.search + location.hash);
};
