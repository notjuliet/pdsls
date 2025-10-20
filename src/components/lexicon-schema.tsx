import { Nsid } from "@atcute/lexicons";
import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, For, Show } from "solid-js";
import { resolveLexiconAuthority } from "../utils/api.js";

// TODO: tidy types

interface LexiconSchema {
  lexicon: number;
  id: string;
  description?: string;
  defs: {
    [key: string]: LexiconDef;
  };
}

interface LexiconDef {
  type: string;
  description?: string;
  key?: string;
  record?: LexiconObject;
  parameters?: LexiconObject;
  input?: { encoding: string; schema?: LexiconObject };
  output?: { encoding: string; schema?: LexiconObject };
  errors?: Array<{ name: string; description?: string }>;
  properties?: { [key: string]: LexiconProperty };
  required?: string[];
  nullable?: string[];
  maxLength?: number;
  minLength?: number;
  maxGraphemes?: number;
  items?: LexiconProperty;
  refs?: string[];
  closed?: boolean;
  enum?: string[];
  const?: string;
  default?: any;
  minimum?: number;
  maximum?: number;
  accept?: string[];
  maxSize?: number;
}

interface LexiconObject {
  type: string;
  description?: string;
  ref?: string;
  refs?: string[];
  closed?: boolean;
  properties?: { [key: string]: LexiconProperty };
  required?: string[];
  nullable?: string[];
}

interface LexiconProperty {
  type: string;
  description?: string;
  ref?: string;
  refs?: string[];
  closed?: boolean;
  format?: string;
  items?: LexiconProperty;
  minLength?: number;
  maxLength?: number;
  maxGraphemes?: number;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  const?: string | boolean | number;
  default?: any;
  knownValues?: string[];
  accept?: string[];
  maxSize?: number;
}

const TypeBadge = (props: { type: string; format?: string; refType?: string }) => {
  const navigate = useNavigate();
  const displayType =
    props.refType ? props.refType.replace(/^#/, "")
    : props.format ? `${props.type}:${props.format}`
    : props.type;

  const isLocalRef = () => props.refType?.startsWith("#");
  const isExternalRef = () => props.refType && !props.refType.startsWith("#");

  const handleClick = async (e: MouseEvent) => {
    e.preventDefault();
    if (isLocalRef()) {
      const defName = props.refType!.slice(1);
      window.history.replaceState(null, "", `#schema:${defName}`);
      const element = document.getElementById(`def-${defName}`);
      if (element) {
        element.scrollIntoView({ behavior: "instant", block: "start" });
      }
    } else if (isExternalRef()) {
      try {
        const [nsid, anchor] = props.refType!.split("#");
        const authority = await resolveLexiconAuthority(nsid as Nsid);

        const hash = anchor ? `#schema:${anchor}` : "#schema";
        navigate(`/at://${authority}/com.atproto.lexicon.schema/${nsid}${hash}`);
      } catch (err) {
        console.error("Failed to resolve lexicon authority:", err);
      }
    }
  };

  return (
    <>
      <Show when={props.refType}>
        <a
          href={props.refType}
          onClick={handleClick}
          class="inline-block rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800 hover:bg-blue-200 hover:underline active:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 dark:active:bg-blue-900/50"
        >
          {displayType}
        </a>
      </Show>
      <Show when={!props.refType}>
        <span class="inline-block rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {displayType}
        </span>
      </Show>
    </>
  );
};

const UnionBadges = (props: { refs: string[] }) => (
  <div class="flex flex-wrap gap-2">
    <For each={props.refs}>{(refType) => <TypeBadge type="union" refType={refType} />}</For>
  </div>
);

const ConstraintsList = (props: { property: LexiconProperty }) => (
  <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
    <Show when={props.property.minLength !== undefined}>
      <span>minLength: {props.property.minLength}</span>
    </Show>
    <Show when={props.property.maxLength !== undefined}>
      <span>maxLength: {props.property.maxLength}</span>
    </Show>
    <Show when={props.property.maxGraphemes !== undefined}>
      <span>maxGraphemes: {props.property.maxGraphemes}</span>
    </Show>
    <Show when={props.property.minimum !== undefined}>
      <span>min: {props.property.minimum}</span>
    </Show>
    <Show when={props.property.maximum !== undefined}>
      <span>max: {props.property.maximum}</span>
    </Show>
    <Show when={props.property.maxSize !== undefined}>
      <span>maxSize: {props.property.maxSize}</span>
    </Show>
    <Show when={props.property.accept}>
      <span>accept: [{props.property.accept!.join(", ")}]</span>
    </Show>
    <Show when={props.property.enum}>
      <span>enum: [{props.property.enum!.join(", ")}]</span>
    </Show>
    <Show when={props.property.const}>
      <span>const: {props.property.const?.toString()}</span>
    </Show>
    <Show when={props.property.default !== undefined}>
      <span>default: {JSON.stringify(props.property.default)}</span>
    </Show>
    <Show when={props.property.knownValues}>
      <span>knownValues: [{props.property.knownValues!.join(", ")}]</span>
    </Show>
    <Show when={props.property.closed}>
      <span>closed: true</span>
    </Show>
  </div>
);

const PropertyRow = (props: {
  name: string;
  property: LexiconProperty;
  required?: boolean;
  hideNameType?: boolean;
}) => {
  const hasConstraints = (property: LexiconProperty) =>
    property.minLength !== undefined ||
    property.maxLength !== undefined ||
    property.maxGraphemes !== undefined ||
    property.minimum !== undefined ||
    property.maximum !== undefined ||
    property.maxSize !== undefined ||
    property.accept ||
    property.enum ||
    property.const ||
    property.default !== undefined ||
    property.knownValues ||
    property.closed;

  return (
    <div class="flex flex-col gap-2 py-3">
      <Show when={!props.hideNameType}>
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-sm font-semibold">{props.name}</span>
          <Show when={!props.property.refs}>
            <TypeBadge
              type={props.property.type}
              format={props.property.format}
              refType={props.property.ref}
            />
          </Show>
          <Show when={props.property.refs}>
            <span class="inline-block rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              union
            </span>
          </Show>
          <Show when={props.required}>
            <span class="text-xs font-semibold text-red-500 dark:text-red-400">required</span>
          </Show>
        </div>
      </Show>
      <Show when={props.property.refs}>
        <UnionBadges refs={props.property.refs!} />
      </Show>
      <Show when={hasConstraints(props.property)}>
        <ConstraintsList property={props.property} />
      </Show>
      <Show when={props.property.items}>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span class="font-semibold">items:</span>
            <Show when={!props.property.items!.refs}>
              <TypeBadge
                type={props.property.items!.type}
                format={props.property.items!.format}
                refType={props.property.items!.ref}
              />
            </Show>
            <Show when={props.property.items!.refs}>
              <span class="inline-block rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                union
              </span>
            </Show>
          </div>
          <Show when={props.property.items!.refs}>
            <UnionBadges refs={props.property.items!.refs!} />
          </Show>
        </div>
      </Show>
      <Show when={props.property.items && hasConstraints(props.property.items)}>
        <ConstraintsList property={props.property.items!} />
      </Show>
      <Show when={props.property.description}>
        <p class="text-sm text-neutral-700 dark:text-neutral-300">{props.property.description}</p>
      </Show>
    </div>
  );
};

const DefSection = (props: { name: string; def: LexiconDef }) => {
  const defTypeColor = () => {
    switch (props.def.type) {
      case "record":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "query":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "procedure":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      case "subscription":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300";
      case "object":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "token":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      default:
        return "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300";
    }
  };

  const handleHeaderClick = (e: MouseEvent) => {
    e.preventDefault();
    window.history.replaceState(null, "", `#schema:${props.name}`);
    const element = document.getElementById(`def-${props.name}`);
    if (element) {
      element.scrollIntoView({ behavior: "instant", block: "start" });
    }
  };

  return (
    <div class="flex flex-col gap-3" id={`def-${props.name}`}>
      <div class="flex items-center gap-2">
        <a
          href={`#schema:${props.name}`}
          onClick={handleHeaderClick}
          class="text-lg font-semibold hover:underline"
        >
          {props.name === "main" ? "Main Definition" : props.name}
        </a>
        <span class={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${defTypeColor()}`}>
          {props.def.type}
        </span>
      </div>

      <Show when={props.def.description}>
        <p class="text-sm text-neutral-700 dark:text-neutral-300">{props.def.description}</p>
      </Show>

      {/* Record key */}
      <Show when={props.def.key}>
        <div>
          <span class="text-sm font-semibold">Record Key: </span>
          <span class="font-mono text-sm">{props.def.key}</span>
        </div>
      </Show>

      {/* Properties (for record/object types) */}
      <Show when={props.def.properties || props.def.record?.properties}>
        <div class="flex flex-col gap-2">
          <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
            Properties
          </h4>
          <div class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/30">
            <For each={Object.entries(props.def.properties || props.def.record?.properties || {})}>
              {([name, property]) => (
                <PropertyRow
                  name={name}
                  property={property}
                  required={(props.def.required || props.def.record?.required || []).includes(name)}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Parameters (for query/procedure) */}
      <Show when={props.def.parameters?.properties}>
        <div class="flex flex-col gap-2">
          <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
            Parameters
          </h4>
          <div class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/30">
            <For each={Object.entries(props.def.parameters!.properties!)}>
              {([name, property]) => (
                <PropertyRow
                  name={name}
                  property={property}
                  required={(props.def.parameters?.required || []).includes(name)}
                />
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Input */}
      <Show when={props.def.input}>
        <div class="flex flex-col gap-2">
          <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
            Input
          </h4>
          <div class="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 dark:border-neutral-700 dark:bg-neutral-800/30">
            <div class="text-sm">
              <span class="font-semibold">Encoding: </span>
              <span class="font-mono">{props.def.input!.encoding}</span>
            </div>
            <Show when={props.def.input!.schema?.ref}>
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold">Schema:</span>
                <TypeBadge type="ref" refType={props.def.input!.schema!.ref} />
              </div>
            </Show>
            <Show when={props.def.input!.schema?.refs}>
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold">Schema (union):</span>
                </div>
                <UnionBadges refs={props.def.input!.schema!.refs!} />
              </div>
            </Show>
            <Show when={props.def.input!.schema?.properties}>
              <div class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/30">
                <For each={Object.entries(props.def.input!.schema!.properties!)}>
                  {([name, property]) => (
                    <PropertyRow
                      name={name}
                      property={property}
                      required={(props.def.input!.schema?.required || []).includes(name)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Output */}
      <Show when={props.def.output}>
        <div class="flex flex-col gap-2">
          <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
            Output
          </h4>
          <div class="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 dark:border-neutral-700 dark:bg-neutral-800/30">
            <div class="text-sm">
              <span class="font-semibold">Encoding: </span>
              <span class="font-mono">{props.def.output!.encoding}</span>
            </div>
            <Show when={props.def.output!.schema?.ref}>
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold">Schema:</span>
                <TypeBadge type="ref" refType={props.def.output!.schema!.ref} />
              </div>
            </Show>
            <Show when={props.def.output!.schema?.refs}>
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold">Schema (union):</span>
                </div>
                <UnionBadges refs={props.def.output!.schema!.refs!} />
              </div>
            </Show>
            <Show when={props.def.output!.schema?.properties}>
              <div class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/30">
                <For each={Object.entries(props.def.output!.schema!.properties!)}>
                  {([name, property]) => (
                    <PropertyRow
                      name={name}
                      property={property}
                      required={(props.def.output!.schema?.required || []).includes(name)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Errors */}
      <Show when={props.def.errors && props.def.errors.length > 0}>
        <div class="flex flex-col gap-2">
          <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
            Errors
          </h4>
          <div class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/30">
            <For each={props.def.errors}>
              {(error) => (
                <div class="flex flex-col gap-1 py-2">
                  <div class="font-mono text-sm font-semibold">{error.name}</div>
                  <Show when={error.description}>
                    <p class="text-sm text-neutral-700 dark:text-neutral-300">
                      {error.description}
                    </p>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Other Definitions */}
      <Show
        when={
          !(
            props.def.properties ||
            props.def.parameters ||
            props.def.input ||
            props.def.output ||
            props.def.errors ||
            props.def.record
          )
        }
      >
        <div class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/30">
          <PropertyRow name={props.name} property={props.def} hideNameType />
        </div>
      </Show>
    </div>
  );
};

export const LexiconSchemaView = (props: { schema: LexiconSchema }) => {
  const location = useLocation();

  // Handle scrolling to a definition when hash is like #schema:definitionName
  createEffect(() => {
    const hash = location.hash;
    if (hash.startsWith("#schema:")) {
      const defName = hash.slice(8);
      setTimeout(() => {
        const element = document.getElementById(`def-${defName}`);
        if (element) {
          element.scrollIntoView({ behavior: "instant", block: "start" });
        }
      }, 100);
    }
  });

  return (
    <div class="w-full max-w-4xl px-2">
      {/* Header */}
      <div class="flex flex-col gap-2 border-b border-neutral-300 pb-4 dark:border-neutral-700">
        <h2 class="text-lg font-semibold">{props.schema.id}</h2>
        <div class="flex gap-4 text-sm text-neutral-600 dark:text-neutral-400">
          <span>
            <span class="font-semibold">Lexicon version: </span>
            <span class="font-mono">{props.schema.lexicon}</span>
          </span>
        </div>
        <Show when={props.schema.description}>
          <p class="text-sm text-neutral-700 dark:text-neutral-300">{props.schema.description}</p>
        </Show>
      </div>

      {/* Definitions */}
      <div class="flex flex-col gap-6 pt-4">
        <For each={Object.entries(props.schema.defs)}>
          {([name, def]) => <DefSection name={name} def={def} />}
        </For>
      </div>
    </div>
  );
};
