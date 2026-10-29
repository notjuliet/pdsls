import { lexiconDoc, type LexiconDoc } from "@atcute/lexicon-doc";
import { RecordValidator } from "@atcute/lexicon-doc/validations";
import type { Nsid } from "@atcute/lexicons";
import { isNsid } from "@atcute/lexicons/syntax";
import type { Issue } from "@atcute/lexicons/validations";
import * as v from "valibot";

import { resolveLexicon } from "./lexicon.js";

interface RecordSchemaValidation {
  valid: boolean;
  error?: string;
  /** Each problem, with the path to the field it's on. */
  issues?: readonly Issue[];
}

const formatBytes = (bytes: number) =>
  bytes >= 1_000_000 ? `${+(bytes / 1_000_000).toFixed(1)} MB` : `${+(bytes / 1000).toFixed(1)} kB`;

/** A limit with either end open, e.g. "at most 300", or "between 1 and 300". */
const range = (min: number, max: number, unit: string) =>
  min > 0 && Number.isFinite(max)
    ? `between ${min} and ${max} ${unit}`
    : min > 0
      ? `at least ${min} ${unit}`
      : `at most ${max} ${unit}`;

/** What's wrong with a field, as a short sentence. */
export const describeIssue = (issue: Issue): string => {
  switch (issue.code) {
    case "missing_value":
      return `Missing required field ${issue.path.at(-1)}`;
    case "invalid_type":
      return `Should be ${issue.expected}`;
    case "invalid_literal":
      return `Should be ${issue.expected.map((value) => JSON.stringify(value)).join(" or ")}`;
    case "invalid_variant":
      return `Should be one of ${issue.expected.join(", ")}`;
    case "invalid_integer_range":
      return `Should be ${range(issue.min, issue.max, "").trim()}`;
    case "invalid_string_format":
      return `Not a valid ${issue.expected}`;
    case "invalid_string_graphemes":
      return `Should be ${range(issue.minGraphemes, issue.maxGraphemes, "graphemes")}`;
    case "invalid_string_length":
      return `Should be ${range(issue.minLength, issue.maxLength, "bytes")}`;
    case "invalid_array_length":
      return `Should have ${range(issue.minLength, issue.maxLength, "items")}`;
    case "invalid_bytes_size":
      return `Should be ${range(issue.minSize, issue.maxSize, "bytes")}`;
    case "invalid_blob_size":
      return `Larger than ${formatBytes(issue.maxSize)}`;
    case "invalid_blob_mime_type":
      return `Should be ${issue.accept.join(" or ")}`;
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
    try {
      // The same lexicons the Schema tab and field cards load, so each is fetched once.
      const { schema } = await resolveLexicon(nsid);
      resolved.set(nsid, schema.schema);
      await Promise.all(
        extractRefs(schema.schema).map((ref) =>
          resolveAllLexicons(ref, depth + 1, resolved, failed, inFlight),
        ),
      );
    } catch {
      // Reported to the user as the lexicon being unavailable, which is common, not as an error.
      failed.add(nsid);
    } finally {
      inFlight.delete(nsid);
    }
  })();

  inFlight.set(nsid, pending);
  await pending;
  return { resolved, failed };
};

/** Lexicon records are checked as lexicon documents, which their own lexicon can't fully describe. */
export const isLexiconRecord = (collection: string) => collection === "com.atproto.lexicon.schema";

export const validateLexiconRecord = (value: unknown): RecordSchemaValidation => {
  const result = v.safeParse(lexiconDoc, value);
  return result.success
    ? { valid: true }
    : { valid: false, error: result.issues[0]?.message ?? "Invalid Lexicon schema record" };
};

/**
 * Starts loading a collection's lexicons, and the ones they reference, before its record has
 * arrived, so checking the record can start from the cache.
 */
export const prefetchRecordLexicons = (collection: string) => {
  if (isNsid(collection) && !isLexiconRecord(collection)) void resolveAllLexicons(collection);
};

/** Checks a record against its published lexicons; throws only when they can't be resolved. */
export const validateResolvedRecordSchema = async (
  collection: string,
  rkey: string,
  value: unknown,
): Promise<RecordSchemaValidation> => {
  if (!isNsid(collection)) throw new Error("Collection is not a valid NSID");

  const { resolved, failed } = await resolveAllLexicons(collection);
  if (failed.size > 0) {
    throw new Error(`Unable to resolve Lexicon documents: ${[...failed].join(", ")}`);
  }

  const validator = new RecordValidator(Object.fromEntries(resolved), collection);
  const result = validator.try({ key: rkey || null, object: value });
  if (result.ok) return { valid: true };
  return {
    valid: false,
    error: result.message,
    // Paths start at the validator's own input: the record is `object`, beside its record `key`.
    // Only the record's own issues have a field to show on; a bad key is in `error` above.
    issues: result.issues
      .filter((issue) => issue.path[0] === "object")
      .map((issue) => ({ ...issue, path: issue.path.slice(1) })),
  };
};
