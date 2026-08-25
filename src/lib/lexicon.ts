import type { ResolvedSchema } from "@atcute/lexicon-resolver";
import type { Nsid } from "@atcute/lexicons";
import type { AtprotoDid } from "@atcute/lexicons/syntax";

import { resolveLexiconAuthority, resolveLexiconSchema, resolveRawLexiconSchema } from "./api.js";

interface CachedLexicon {
  authority: AtprotoDid;
  schema: ResolvedSchema;
}

const cache = new Map<string, Promise<CachedLexicon>>();
const rawCache = new Map<string, Promise<Awaited<ReturnType<typeof resolveRawLexiconSchema>>>>();

export const parseLexiconRef = (lexicon: string) => {
  const [nsid, defName] = lexicon.split("#");
  return { nsid, defName };
};

export const schemaHash = (defName?: string) => (defName ? `#schema:${defName}` : "#schema");

export const schemaHref = (nsid: string, defName?: string) =>
  `/lexicon/${nsid}${schemaHash(defName)}`;

export const lexiconRecordHref = (nsid: string) => `/lexicon/${nsid}#record`;

export const resolveLexicon = (nsid: Nsid): Promise<CachedLexicon> => {
  let cached = cache.get(nsid);
  if (cached) return cached;

  const promise = (async () => {
    const authority = await resolveLexiconAuthority(nsid);
    const schema = await resolveLexiconSchema(authority, nsid);
    return { authority, schema };
  })();

  cache.set(nsid, promise);
  promise.catch(() => cache.delete(nsid));
  return promise;
};

export const resolveRawLexicon = (nsid: Nsid) => {
  let cached = rawCache.get(nsid);
  if (cached) return cached;

  const promise = (async () => {
    const authority = await resolveLexiconAuthority(nsid);
    return await resolveRawLexiconSchema(authority, nsid);
  })();

  rawCache.set(nsid, promise);
  promise.catch(() => rawCache.delete(nsid));
  return promise;
};
