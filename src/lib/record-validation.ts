import { Client, simpleFetchHandler } from "@atcute/client";
import { type DidDocument, getPdsEndpoint } from "@atcute/identity";
import { lexiconDoc, type LexiconDoc } from "@atcute/lexicon-doc";
import { RecordValidator } from "@atcute/lexicon-doc/validations";
import { FailedLexiconResolutionError } from "@atcute/lexicon-resolver";
import { is, type Nsid } from "@atcute/lexicons";
import { type AtprotoDid, isNsid } from "@atcute/lexicons/syntax";
import * as v from "valibot";

import { didDocumentResolver, resolveLexiconAuthority } from "./api.js";
import { lexicons } from "./types/lexicons.js";

export interface RecordSchemaValidation {
  valid: boolean;
  error?: string;
}

const authorityCache = new Map<string, Promise<AtprotoDid>>();
const documentCache = new Map<string, Promise<DidDocument>>();
const schemaCache = new Map<string, Promise<LexiconDoc>>();

const getAuthoritySegment = (nsid: string): string => {
  const segments = nsid.split(".");
  return segments.slice(0, -1).join(".");
};

const resolveSchema = async (authority: AtprotoDid, nsid: Nsid): Promise<LexiconDoc> => {
  const cacheKey = `${authority}:${nsid}`;
  const existing = schemaCache.get(cacheKey);
  if (existing) return existing;

  const pending = (async () => {
    let document = documentCache.get(authority);
    if (!document) {
      document = didDocumentResolver().resolve(authority);
      documentCache.set(authority, document);
    }

    const pds = getPdsEndpoint(await document);
    if (!pds) {
      throw new FailedLexiconResolutionError(nsid, {
        cause: new TypeError(`no pds service in did document; did=${authority}`),
      });
    }

    const rpc = new Client({ handler: simpleFetchHandler({ service: pds }) });
    const response = await rpc.get("com.atproto.repo.getRecord", {
      params: {
        repo: authority,
        collection: "com.atproto.lexicon.schema",
        rkey: nsid,
      },
    });
    if (!response.ok) throw new Error(`got http ${response.status}`);
    return v.parse(lexiconDoc, response.data.value);
  })();

  schemaCache.set(cacheKey, pending);
  try {
    return await pending;
  } catch (err) {
    schemaCache.delete(cacheKey);
    throw err;
  }
};

const extractRefs = (value: unknown): Nsid[] => {
  const refs = new Set<Nsid>();

  const visit = (item: unknown) => {
    if (!item || typeof item !== "object") return;

    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }

    const object = item as Record<string, unknown>;
    if (object.type === "ref" && typeof object.ref === "string" && !object.ref.startsWith("#")) {
      const nsid = object.ref.split("#")[0];
      if (isNsid(nsid)) refs.add(nsid);
    }

    if (object.type === "union" && Array.isArray(object.refs)) {
      for (const ref of object.refs) {
        if (typeof ref !== "string" || ref.startsWith("#")) continue;
        const nsid = ref.split("#")[0];
        if (isNsid(nsid)) refs.add(nsid);
      }
    }

    Object.values(object).forEach(visit);
  };

  visit(value);
  return [...refs];
};

const resolveAllLexicons = async (
  nsid: Nsid,
  depth = 0,
  resolved = new Map<string, LexiconDoc>(),
  failed = new Set<string>(),
  inFlight = new Map<string, Promise<void>>(),
): Promise<{ resolved: Map<string, LexiconDoc>; failed: Set<string> }> => {
  if (depth >= 10 || resolved.has(nsid) || failed.has(nsid)) return { resolved, failed };

  const existing = inFlight.get(nsid);
  if (existing) {
    await existing;
    return { resolved, failed };
  }

  const pending = (async () => {
    let authority: AtprotoDid | undefined;
    const authoritySegment = getAuthoritySegment(nsid);
    try {
      let resolvedAuthority = authorityCache.get(authoritySegment);
      if (!resolvedAuthority) {
        resolvedAuthority = resolveLexiconAuthority(nsid);
        authorityCache.set(authoritySegment, resolvedAuthority);
      }

      authority = await resolvedAuthority;
      const schema = await resolveSchema(authority, nsid);
      resolved.set(nsid, schema);
      await Promise.all(
        extractRefs(schema).map((ref) =>
          resolveAllLexicons(ref, depth + 1, resolved, failed, inFlight),
        ),
      );
    } catch (err) {
      console.error(`Failed to resolve lexicon ${nsid}:`, err);
      failed.add(nsid);
      authorityCache.delete(authoritySegment);
      if (authority) documentCache.delete(authority);
    } finally {
      inFlight.delete(nsid);
    }
  })();

  inFlight.set(nsid, pending);
  await pending;
  return { resolved, failed };
};

export const hasKnownRecordSchema = (collection: string) =>
  collection === "com.atproto.lexicon.schema" || collection in lexicons;

export const validateKnownRecordSchema = (
  collection: string,
  value: unknown,
): RecordSchemaValidation | undefined => {
  if (collection === "com.atproto.lexicon.schema") {
    const result = v.safeParse(lexiconDoc, value);
    return result.success
      ? { valid: true }
      : { valid: false, error: result.issues[0]?.message ?? "Invalid Lexicon schema record" };
  }

  if (!(collection in lexicons)) return;
  return is(lexicons[collection], value)
    ? { valid: true }
    : { valid: false, error: "Record does not match the bundled Lexicon schema" };
};

export const validateResolvedRecordSchema = async (
  collection: string,
  rkey: string,
  value: unknown,
): Promise<void> => {
  if (!isNsid(collection)) throw new Error("Collection is not a valid NSID");

  const { resolved, failed } = await resolveAllLexicons(collection);
  if (failed.size > 0) {
    throw new Error(`Unable to resolve Lexicon documents: ${[...failed].join(", ")}`);
  }

  const validator = new RecordValidator(Object.fromEntries(resolved), collection);
  validator.parse({ key: rkey || null, object: value });
};
