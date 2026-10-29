import type { Nsid } from "@atcute/lexicons";

import type { LexiconDef, LexiconProperty, LexiconSchema } from "../components/lexicon-schema.jsx";
import { resolveLexicon } from "./lexicon.js";

/** One step into a record: a key of an object, with that object's `$type`, or an array index. */
export interface FieldStep {
  key: string | number;
  objectType?: string;
}

export interface FieldSchema {
  /** The definition the field belongs to, e.g. `app.bsky.embed.images#image`. */
  definedIn: string;
  /** Missing when the record has a field its schema doesn't define. */
  property?: LexiconProperty;
  required?: boolean;
}

type SchemaNode = LexiconDef | LexiconProperty;

interface Located {
  node: SchemaNode;
  nsid: string;
  defName: string;
}

const loadSchema = async (nsid: string) =>
  (await resolveLexicon(nsid as Nsid)).schema.rawSchema as LexiconSchema;

/** A ref like `#image` or `app.bsky.embed.images#main`, in full and without `#main`. */
export const absoluteRef = (ref: string, nsid: string) => {
  const full = ref.startsWith("#") ? `${nsid}${ref}` : ref;
  return full.endsWith("#main") ? full.slice(0, -"#main".length) : full;
};

const defId = (nsid: string, defName: string) => (defName === "main" ? nsid : `${nsid}#${defName}`);

/**
 * Follows refs, and a union by the value's `$type`, to the definition the value actually has.
 * Other lexicons are only fetched here, when a field needs them.
 */
const resolveNode = async (at: Located, objectType?: string): Promise<Located | undefined> => {
  let current = at;
  // A ref can lead to another; the limit only guards against a cycle.
  for (let hops = 0; hops < 8; hops++) {
    let ref: string | undefined;
    if (current.node.type === "ref") {
      ref = (current.node as LexiconProperty).ref;
    } else if (current.node.type === "union") {
      if (!objectType) return;
      const wanted = absoluteRef(objectType, current.nsid);
      ref = current.node.refs?.find((r) => absoluteRef(r, current.nsid) === wanted);
    } else {
      return current;
    }
    if (!ref) return;

    const [nsid, defName = "main"] = absoluteRef(ref, current.nsid).split("#");
    const def = (await loadSchema(nsid)).defs[defName];
    if (!def) return;
    current = { node: def, nsid, defName };
  }
};

/** The schema of the field at a path in a record of `collection`, if its lexicon has one. */
export const fieldSchemaAt = async (
  collection: string,
  steps: FieldStep[],
): Promise<FieldSchema | undefined> => {
  const record = (await loadSchema(collection)).defs.main?.record;
  if (!record) return;

  let current: Located = { node: record as SchemaNode, nsid: collection, defName: "main" };
  let field: FieldSchema | undefined;
  for (const [index, step] of steps.entries()) {
    const container = await resolveNode(current, step.objectType);
    if (!container) return;
    const definedIn = defId(container.nsid, container.defName);

    if (typeof step.key === "number") {
      if (container.node.type !== "array" || !container.node.items) return;
      field = { definedIn, property: container.node.items };
      current = { ...container, node: container.node.items };
      continue;
    }

    // `$type` names the definition rather than being one of its fields.
    if (container.node.type !== "object" || step.key === "$type") return;
    const property = (container.node as LexiconDef).properties?.[step.key];
    if (!property) {
      // Only the field itself is flagged; what's inside it has nothing to compare against.
      return index === steps.length - 1 ? { definedIn } : undefined;
    }
    field = {
      definedIn,
      property,
      required: (container.node as LexiconDef).required?.includes(step.key),
    };
    current = { ...container, node: property };
  }
  return field;
};
