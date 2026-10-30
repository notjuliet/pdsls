/** Known DID document service types: a short name, and the id they're normally listed under. */
const KNOWN_SERVICES: Record<string, { label: string; id: string }> = {
  AtprotoPersonalDataServer: { label: "PDS", id: "atproto_pds" },
  AtprotoLabeler: { label: "Labeler", id: "atproto_labeler" },
  BskyFeedGenerator: { label: "Feed generator", id: "bsky_fg" },
  TangledKnot: { label: "Knot", id: "tangled_knot" },
};

/** A short name for a service type, or the type itself if it isn't a known one. */
export const serviceLabel = (type: string) => KNOWN_SERVICES[type]?.label ?? type;

/** Whether a service id (without `#`) is the usual one for its type, so the type alone says what it is. */
export const hasStandardServiceId = (type: string, id: string) => KNOWN_SERVICES[type]?.id === id;
