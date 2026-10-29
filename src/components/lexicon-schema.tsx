import type { Nsid } from "@atcute/lexicons";
import { A, useLocation } from "@solidjs/router";
import { createContext, createEffect, For, type JSX, Show, useContext } from "solid-js";

import {
  lexiconRecordHref,
  parseLexiconRef,
  resolveLexicon,
  schemaHash,
  schemaHref,
} from "../lib/lexicon";
import HoverCard, { HoverCardError } from "./hover-card/base";
import { createHoverResource } from "./hover-card/resource";

// Style constants
const CONTAINER_CLASS =
  "divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/30";

const CARD_CLASS =
  "flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 dark:border-neutral-700 dark:bg-neutral-800/30";

const SECTION_HEADING_CLASS = "text-sm font-medium text-neutral-800 dark:text-neutral-200";

/** A muted label line under a heading, like "Record key:" or "Encoding:". */
const INFO_LINE_CLASS = "w-fit text-sm text-neutral-500 dark:text-neutral-400";

/** A value after a muted label, like a constraint's or the record key's. */
const VALUE_CLASS = "text-neutral-700 dark:text-neutral-300";

const DESCRIPTION_CLASS = "text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300";

const RESOURCE_COLORS = {
  repo: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rpc: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  default: "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300",
} as const;

const DEF_TYPE_COLORS = {
  record: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  query: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  procedure: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  subscription: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  object: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  token: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "permission-set": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  default: "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300",
} as const;

// Utility functions
const hasConstraints = (property: LexiconProperty | LexiconDef) =>
  property.minLength !== undefined ||
  property.maxLength !== undefined ||
  property.maxGraphemes !== undefined ||
  property.minGraphemes !== undefined ||
  property.minimum !== undefined ||
  property.maximum !== undefined ||
  property.maxSize !== undefined ||
  property.accept ||
  property.enum ||
  property.const ||
  property.default !== undefined ||
  property.knownValues;

/** A union's type as shown: "closed union" when only its listed types are allowed. */
const unionType = (union: { closed?: boolean }) => (union.closed ? "closed union" : "union");

const LexiconSchemaContext = createContext<{ inertRefs?: boolean }>();
const useLexiconSchemaContext = () => useContext(LexiconSchemaContext) ?? {};

const schemaDefId = (defName: string) => `schema:${defName}`;
const SCHEMA_REF_TEXT_CLASS = "font-mono wrap-break-word text-blue-500 dark:text-blue-400";
/** The size of a type or reference, unless it says otherwise. */
const TYPE_SIZE = "text-xs";
const SCHEMA_LINK_CLASS = `${SCHEMA_REF_TEXT_CLASS} cursor-pointer hover:underline`;
const PREVIEW_DEFINITION_LIMIT = 6;

const keepLocalHashNavigationNative = (event: MouseEvent) => event.stopPropagation();

const LocalSchemaLink = (props: { defName: string; class: string; children: JSX.Element }) => (
  <a href={schemaHash(props.defName)} on:click={keepLocalHashNavigationNative} class={props.class}>
    {props.children}
  </a>
);

const SchemaRefLink = (props: {
  refType: string;
  size?: string;
  /** The color when it isn't a link. */
  color?: string;
  children: JSX.Element;
}) => {
  const context = useLexiconSchemaContext();
  const size = props.size ?? TYPE_SIZE;

  // Not a link here, so colored like any other type rather than blue.
  if (context.inertRefs) {
    return (
      <span
        class={`font-mono wrap-break-word ${props.color ?? "text-neutral-600 dark:text-neutral-300"} ${size}`}
      >
        {props.children}
      </span>
    );
  }

  if (props.refType.startsWith("#")) {
    return (
      <LocalSchemaLink defName={props.refType.slice(1)} class={`${SCHEMA_LINK_CLASS} ${size}`}>
        {props.children}
      </LocalSchemaLink>
    );
  }

  return (
    <SchemaRefHoverCard refType={props.refType} size={size}>
      {props.children}
    </SchemaRefHoverCard>
  );
};

export interface LexiconSchema {
  lexicon: number;
  id: string;
  description?: string;
  defs: {
    [key: string]: LexiconDef;
  };
}

const fetchLexiconPreview = async (nsid: string): Promise<LexiconSchema> => {
  const { schema } = await resolveLexicon(nsid as Nsid);
  return schema.rawSchema as LexiconSchema;
};

function SchemaRefHoverCard(props: { refType: string; size: string; children: JSX.Element }) {
  const parsed = () => parseLexiconRef(props.refType);
  const preview = createHoverResource(() => parsed().nsid, fetchLexiconPreview, {
    getErrorMessage: (err) => (err instanceof Error ? err.message : "Failed to resolve schema"),
  });
  const loading = preview.visibleLoading;
  const hasPreview = () => Boolean(preview.state().data || preview.state().error);
  const trigger = () => (
    <A
      href={schemaHref(parsed().nsid, parsed().defName)}
      class={`${SCHEMA_LINK_CLASS} ${props.size}`}
      classList={{ "hover-card-trigger-loading": loading() }}
    >
      {props.children}
    </A>
  );

  return (
    <HoverCard
      onHover={preview.load}
      hoverDelay={300}
      trigger={trigger()}
      class={`inline ${props.size} ${props.size === TYPE_SIZE ? "leading-4" : ""}`}
      previewClass="max-h-[32rem] w-[min(36rem,calc(100vw-2rem))] font-sans text-sm"
      showPreview={hasPreview()}
    >
      <Show when={preview.state().error}>
        <HoverCardError message={preview.state().error} />
      </Show>
      <Show when={preview.state().data}>
        {(data) => (
          <LexiconSchemaView schema={data()} preview inertRefs focusDef={parsed().defName} />
        )}
      </Show>
    </HoverCard>
  );
}

interface LexiconPermission {
  type: "permission";
  // NOTE: blob, account, and identity are not supported in lexicon schema context
  resource: "repo" | "rpc" | "blob" | "account" | "identity";
  collection?: string[];
  action?: string[];
  lxm?: string[];
  aud?: string;
  inheritAud?: boolean;
}

export interface LexiconDef {
  type: string;
  description?: string;
  key?: string;
  record?: LexiconObject;
  parameters?: LexiconObject;
  input?: LexiconBody;
  output?: LexiconBody;
  errors?: Array<{ name: string; description?: string }>;
  properties?: { [key: string]: LexiconProperty };
  required?: string[];
  nullable?: string[];
  maxLength?: number;
  minLength?: number;
  maxGraphemes?: number;
  minGraphemes?: number;
  items?: LexiconProperty;
  refs?: string[];
  closed?: boolean;
  enum?: string[];
  const?: string;
  default?: string | number | boolean;
  minimum?: number;
  maximum?: number;
  accept?: string[];
  maxSize?: number;
  knownValues?: string[];
  format?: string;
  // Permission-set fields
  title?: string;
  "title:lang"?: { [lang: string]: string };
  detail?: string;
  "detail:lang"?: { [lang: string]: string };
  permissions?: LexiconPermission[];
}

interface LexiconBody {
  encoding: string;
  description?: string;
  schema?: LexiconObject;
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

export interface LexiconProperty {
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
  minGraphemes?: number;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  const?: string | boolean | number;
  default?: string | number | boolean;
  knownValues?: string[];
  accept?: string[];
  maxSize?: number;
}

const TypeBadge = (props: {
  type: string;
  format?: string;
  refType?: string;
  /** The text color, muted unless the type is a value, e.g. after `items:`. */
  color?: string;
  /** Larger next to a property's name. */
  size?: string;
}) => {
  const displayType = props.refType
    ? props.refType.replace(/^#/, "")
    : props.format
      ? `${props.type}:${props.format}`
      : props.type;

  return (
    <Show
      when={props.refType}
      fallback={
        <span
          class={`font-mono ${props.size ?? TYPE_SIZE} ${props.color ?? "text-neutral-600 dark:text-neutral-300"}`}
        >
          {displayType}
        </span>
      }
    >
      <SchemaRefLink refType={props.refType!} size={props.size} color={props.color}>
        {displayType}
      </SchemaRefLink>
    </Show>
  );
};

/**
 * A union's types. With `current`, the one a record's value has, that one comes first in bold,
 * ahead of the others it could have been.
 */
const UnionBadges = (props: { refs: string[]; current?: string }) => (
  <div class="flex flex-col items-start gap-1">
    <Show when={props.current && props.refs.includes(props.current) && props.current}>
      {(current) => (
        <TypeBadge
          type="union"
          refType={current()}
          color="font-medium text-neutral-900 dark:text-neutral-100"
        />
      )}
    </Show>
    <For each={props.refs.filter((refType) => refType !== props.current)}>
      {(refType) => <TypeBadge type="union" refType={refType} />}
    </For>
  </div>
);

const ConstraintsList = (props: { property: LexiconProperty }) => {
  return (
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
      <Show when={props.property.minLength !== undefined}>
        <span>
          minLength: <span class={VALUE_CLASS}>{props.property.minLength}</span>
        </span>
      </Show>
      <Show when={props.property.maxLength !== undefined}>
        <span>
          maxLength: <span class={VALUE_CLASS}>{props.property.maxLength}</span>
        </span>
      </Show>
      <Show when={props.property.maxGraphemes !== undefined}>
        <span>
          maxGraphemes: <span class={VALUE_CLASS}>{props.property.maxGraphemes}</span>
        </span>
      </Show>
      <Show when={props.property.minGraphemes !== undefined}>
        <span>
          minGraphemes: <span class={VALUE_CLASS}>{props.property.minGraphemes}</span>
        </span>
      </Show>
      <Show when={props.property.minimum !== undefined}>
        <span>
          min: <span class={VALUE_CLASS}>{props.property.minimum}</span>
        </span>
      </Show>
      <Show when={props.property.maximum !== undefined}>
        <span>
          max: <span class={VALUE_CLASS}>{props.property.maximum}</span>
        </span>
      </Show>
      <Show when={props.property.maxSize !== undefined}>
        <span>
          maxSize: <span class={VALUE_CLASS}>{props.property.maxSize}</span>
        </span>
      </Show>
      <Show when={props.property.accept}>
        <span>
          accept: <span class={VALUE_CLASS}>[{props.property.accept!.join(", ")}]</span>
        </span>
      </Show>
      <Show when={props.property.enum}>
        <span>
          enum: <span class={VALUE_CLASS}>[{props.property.enum!.join(", ")}]</span>
        </span>
      </Show>
      <Show when={props.property.const}>
        <span>
          const: <span class={VALUE_CLASS}>{props.property.const?.toString()}</span>
        </span>
      </Show>
      <Show when={props.property.default !== undefined}>
        <span>
          default: <span class={VALUE_CLASS}>{JSON.stringify(props.property.default)}</span>
        </span>
      </Show>
      <Show when={props.property.knownValues}>
        <span>
          knownValues: <span class={VALUE_CLASS}>[{props.property.knownValues!.join(", ")}]</span>
        </span>
      </Show>
    </div>
  );
};

const PropertyRow = (props: {
  name: string;
  property: LexiconProperty;
  required?: boolean;
  hideNameType?: boolean;
  /** In place of the row's vertical padding, e.g. none in a hover card. */
  class?: string;
  /** For a union, the type a record's value has, as written in the union's list. */
  currentType?: string;
}) => {
  return (
    <div class={`flex flex-col gap-2 ${props.class ?? "py-3"}`}>
      <Show when={!props.hideNameType}>
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="font-semibold">{props.name}</span>
          <Show when={!props.property.refs}>
            <TypeBadge
              type={props.property.type}
              format={props.property.format}
              refType={props.property.ref}
              size="text-sm"
            />
          </Show>
          <Show when={props.property.refs}>
            <TypeBadge type={unionType(props.property)} size="text-sm" />
          </Show>
          <Show when={props.required}>
            <span class="text-sm text-amber-600 dark:text-amber-500">required</span>
          </Show>
        </div>
      </Show>
      <Show when={props.property.refs}>
        <UnionBadges refs={props.property.refs!} current={props.currentType} />
      </Show>
      <Show when={hasConstraints(props.property)}>
        <ConstraintsList property={props.property} />
      </Show>
      <Show when={props.property.items}>
        <div class="flex flex-col gap-2">
          <div class="flex items-baseline gap-2 text-xs">
            <span class="text-neutral-500 dark:text-neutral-400">items:</span>
            <Show when={!props.property.items!.refs}>
              <TypeBadge
                type={props.property.items!.type}
                format={props.property.items!.format}
                refType={props.property.items!.ref}
                color={VALUE_CLASS}
              />
            </Show>
            <Show when={props.property.items!.refs}>
              <TypeBadge type={unionType(props.property.items!)} color={VALUE_CLASS} />
            </Show>
          </div>
          {/* Nested under the items line, so they don't read as the array's own. */}
          <Show when={props.property.items!.refs || hasConstraints(props.property.items!)}>
            <div class="ml-1 flex flex-col gap-2 border-l border-neutral-300 pl-3 dark:border-neutral-600">
              <Show when={props.property.items!.refs}>
                <UnionBadges refs={props.property.items!.refs!} />
              </Show>
              <Show when={hasConstraints(props.property.items!)}>
                <ConstraintsList property={props.property.items!} />
              </Show>
            </div>
          </Show>
        </div>
      </Show>
      <Show when={props.property.description && !props.hideNameType}>
        <p class="text-sm wrap-break-word whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
          {props.property.description}
        </p>
      </Show>
    </div>
  );
};

const NsidLink = (props: { nsid: string }) => {
  return <SchemaRefLink refType={props.nsid}>{props.nsid}</SchemaRefLink>;
};

const resourceColor = (resource: string) =>
  RESOURCE_COLORS[resource as keyof typeof RESOURCE_COLORS] || RESOURCE_COLORS.default;

/** An input or output body: its encoding and descriptions, then its schema. */
const SchemaSection = (props: { title: string; body: LexiconBody }) => {
  const schema = () => props.body.schema;
  return (
    <div class="flex flex-col gap-2">
      <h4 class={SECTION_HEADING_CLASS}>{props.title}</h4>
      <span class={INFO_LINE_CLASS}>
        Encoding: <span class={VALUE_CLASS}>{props.body.encoding}</span>
      </span>
      <Show when={props.body.description}>
        <p class={DESCRIPTION_CLASS}>{props.body.description}</p>
      </Show>
      <Show when={schema()?.description}>
        <p class={DESCRIPTION_CLASS}>{schema()!.description}</p>
      </Show>
      <Show when={schema()?.ref}>
        <span class={`flex items-baseline gap-2 ${INFO_LINE_CLASS}`}>
          Schema:
          <TypeBadge type="ref" refType={schema()!.ref} size="text-sm" />
        </span>
      </Show>
      <Show when={schema()?.refs}>
        <span class={INFO_LINE_CLASS}>
          Schema: <TypeBadge type={unionType(schema()!)} size="text-sm" color={VALUE_CLASS} />
        </span>
        <div class="ml-1 border-l border-neutral-300 pl-3 dark:border-neutral-600">
          <UnionBadges refs={schema()!.refs!} />
        </div>
      </Show>
      <Show when={schema()?.properties && Object.keys(schema()!.properties!).length > 0}>
        <div class={CONTAINER_CLASS}>
          <For each={Object.entries(schema()!.properties!)}>
            {([name, property]) => (
              <PropertyRow
                name={name}
                property={property}
                required={(schema()?.required || []).includes(name)}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

const PermissionRow = (props: { permission: LexiconPermission; index: number }) => {
  return (
    <div class="flex flex-col gap-2 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-semibold">#{props.index + 1}</span>
        <span
          class={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${resourceColor(props.permission.resource)}`}
        >
          {props.permission.resource}
        </span>
      </div>

      {/* Collections (for repo resource) */}
      <Show when={props.permission.collection && props.permission.collection.length > 0}>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Collections:
          </span>
          <div class="flex flex-col items-start gap-1">
            <For each={props.permission.collection}>{(col) => <NsidLink nsid={col} />}</For>
          </div>
        </div>
      </Show>

      {/* Actions */}
      <Show when={props.permission.action && props.permission.action.length > 0}>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Actions:</span>
          <div class="flex flex-wrap gap-1">
            <For each={props.permission.action}>
              {(action) => (
                <span class="dark:bg-dark-200 rounded bg-neutral-200/50 px-1.5 py-0.5 font-mono text-xs">
                  {action}
                </span>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* LXM (for rpc resource) */}
      <Show when={props.permission.lxm && props.permission.lxm.length > 0}>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Lexicon Methods:
          </span>
          <div class="flex flex-col items-start gap-1">
            <For each={props.permission.lxm}>{(method) => <NsidLink nsid={method} />}</For>
          </div>
        </div>
      </Show>

      {/* Audience */}
      <Show when={props.permission.aud}>
        <div class="flex items-center gap-2 text-xs">
          <span class="font-semibold text-neutral-500 dark:text-neutral-400">Audience:</span>
          <span class="font-mono">{props.permission.aud}</span>
        </div>
      </Show>

      {/* Inherit Audience */}
      <Show when={props.permission.inheritAud}>
        <div class="flex items-center gap-1 text-xs">
          <span class="font-semibold text-neutral-500 dark:text-neutral-400">
            Inherit Audience:
          </span>
          <span>true</span>
        </div>
      </Show>
    </div>
  );
};

/** What a record key type means, for its tooltip. */
const describeRecordKey = (key: string) => {
  if (key === "tid") return "TID (timestamp ID): based on when the record was created";
  if (key === "nsid") return "An NSID, e.g. com.example.thing";
  if (key === "any") return "Any valid record key";
  if (key.startsWith("literal:")) return `Always "${key.slice(8)}": one record per account`;
  return undefined;
};

const DefSection = (props: { name: string; def: LexiconDef; preview?: boolean }) => {
  const defTypeColor = () =>
    DEF_TYPE_COLORS[props.def.type as keyof typeof DEF_TYPE_COLORS] || DEF_TYPE_COLORS.default;

  const hasDefContent = () => props.def.refs || props.def.items || hasConstraints(props.def);

  return (
    <div
      class="flex scroll-mt-4 flex-col"
      classList={{ "gap-3": !props.preview, "gap-2": props.preview }}
      id={schemaDefId(props.name)}
    >
      <div class="group flex items-center gap-2">
        <LocalSchemaLink defName={props.name} class="relative font-semibold hover:underline">
          <span class="iconify lucide--link absolute top-1/2 -left-6 -translate-y-1/2 text-base opacity-0 transition-opacity group-hover:opacity-100" />
          {props.name === "main" ? "Main Definition" : props.name}
        </LocalSchemaLink>
        <span class={`rounded px-1.5 py-0.5 text-xs font-semibold ${defTypeColor()}`}>
          <span class="uppercase">{props.def.type.replace("-", " ")}</span>
        </span>
      </div>

      <Show when={props.def.key}>
        {(key) => (
          <span class={INFO_LINE_CLASS} title={describeRecordKey(key())}>
            Record key: <span class={VALUE_CLASS}>{key()}</span>
          </span>
        )}
      </Show>

      <Show when={props.def.description}>
        <p class={DESCRIPTION_CLASS}>{props.def.description}</p>
      </Show>

      {/* Permission-set: Title and Detail */}
      <Show when={props.def.type === "permission-set" && (props.def.title || props.def.detail)}>
        <div class={CARD_CLASS}>
          <Show when={props.def.title}>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-neutral-500 uppercase dark:text-neutral-400">
                Title
              </span>
              <span class="text-sm font-medium">{props.def.title}</span>
            </div>
          </Show>
          <Show when={props.def["title:lang"]}>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-neutral-500 uppercase dark:text-neutral-400">
                Localized Titles
              </span>
              <div class="flex flex-col gap-1">
                <For each={Object.entries(props.def["title:lang"]!)}>
                  {([lang, text]) => (
                    <div class="flex items-center gap-2 text-sm">
                      <span class="dark:bg-dark-200 rounded bg-neutral-200/50 px-1.5 py-0.5 font-mono text-xs">
                        {lang}
                      </span>
                      <span>{text}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <Show when={props.def.detail}>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-neutral-500 uppercase dark:text-neutral-400">
                Detail
              </span>
              <p class="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                {props.def.detail}
              </p>
            </div>
          </Show>
          <Show when={props.def["detail:lang"]}>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-neutral-500 uppercase dark:text-neutral-400">
                Localized Details
              </span>
              <div class="flex flex-col gap-1">
                <For each={Object.entries(props.def["detail:lang"]!)}>
                  {([lang, text]) => (
                    <div class="flex flex-col gap-1 text-sm">
                      <span class="dark:bg-dark-200 w-fit rounded bg-neutral-200/50 px-1.5 py-0.5 font-mono text-xs">
                        {lang}
                      </span>
                      <p class="whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                        {text}
                      </p>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Permission-set: Permissions list */}
      <Show
        when={
          props.def.permissions &&
          props.def.permissions.filter((p) => p.resource === "repo" || p.resource === "rpc")
            .length > 0
        }
      >
        <div class="flex flex-col gap-2">
          <h4 class={SECTION_HEADING_CLASS}>Permissions</h4>
          <div class={CONTAINER_CLASS}>
            <For
              each={props.def.permissions!.filter(
                (p) => p.resource === "repo" || p.resource === "rpc",
              )}
            >
              {(permission, index) => <PermissionRow permission={permission} index={index()} />}
            </For>
          </div>
        </div>
      </Show>

      {/* Properties (for record/object types) */}
      <Show
        when={Object.keys(props.def.properties || props.def.record?.properties || {}).length > 0}
      >
        <div class="flex flex-col gap-2">
          <h4 class={SECTION_HEADING_CLASS}>Properties</h4>
          <div class={CONTAINER_CLASS}>
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
      <Show
        when={
          props.def.parameters?.properties &&
          Object.keys(props.def.parameters.properties).length > 0
        }
      >
        <div class="flex flex-col gap-2">
          <h4 class={SECTION_HEADING_CLASS}>Parameters</h4>
          <div class={CONTAINER_CLASS}>
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
        <SchemaSection title="Input" body={props.def.input!} />
      </Show>

      {/* Output */}
      <Show when={props.def.output}>
        <SchemaSection title="Output" body={props.def.output!} />
      </Show>

      {/* Errors */}
      <Show when={props.def.errors && props.def.errors.length > 0}>
        <div class="flex flex-col gap-2">
          <h4 class={SECTION_HEADING_CLASS}>Errors</h4>
          <div class={CONTAINER_CLASS}>
            <For each={props.def.errors}>
              {(error) => (
                <div class="flex flex-col gap-1 py-2">
                  <div class="font-semibold">{error.name}</div>
                  <Show when={error.description}>
                    <p class={DESCRIPTION_CLASS}>{error.description}</p>
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
          ) && hasDefContent()
        }
      >
        <div class={CONTAINER_CLASS}>
          <PropertyRow name={props.name} property={props.def} hideNameType />
        </div>
      </Show>
    </div>
  );
};

/** One property as the Schema tab shows it, e.g. for a record's field in a hover card. */
export const LexiconPropertyView = (props: {
  name: string;
  property: LexiconProperty;
  required?: boolean;
  /** For a union, the type the record's value has, which is listed first. */
  currentType?: string;
}) => (
  <LexiconSchemaContext.Provider value={{ inertRefs: true }}>
    <PropertyRow
      name={props.name}
      property={props.property}
      required={props.required}
      currentType={props.currentType}
      class=""
    />
  </LexiconSchemaContext.Provider>
);

export const LexiconSchemaView = (props: {
  schema: LexiconSchema;
  preview?: boolean;
  inertRefs?: boolean;
  focusDef?: string;
}) => {
  const location = useLocation();

  const allDefinitionEntries = () => Object.entries(props.schema.defs);
  const visibleDefinitionEntries = () => {
    const entries = allDefinitionEntries();
    if (!props.preview) return entries;

    if (props.focusDef && props.schema.defs[props.focusDef]) {
      return [[props.focusDef, props.schema.defs[props.focusDef]]] as Array<[string, LexiconDef]>;
    }

    const visible = new Map<string, LexiconDef>();
    if (props.schema.defs.main) visible.set("main", props.schema.defs.main);
    for (const [name, def] of entries) {
      if (visible.size >= PREVIEW_DEFINITION_LIMIT) break;
      visible.set(name, def);
    }

    return Array.from(visible.entries());
  };

  const hiddenDefinitionCount = () =>
    allDefinitionEntries().length - visibleDefinitionEntries().length;

  // Handle scrolling to a definition when hash is like #schema:definitionName
  createEffect(() => {
    if (props.preview) return;
    const hash = location.hash;
    if (hash.startsWith("#schema:")) {
      const defName = hash.slice(8);
      requestAnimationFrame(() => {
        const element = document.getElementById(schemaDefId(defName));
        if (element) element.scrollIntoView({ behavior: "instant", block: "start" });
      });
    }
  });

  return (
    <LexiconSchemaContext.Provider value={{ inertRefs: props.inertRefs }}>
      <div class="w-full" classList={{ "px-2": !props.preview }}>
        {/* Header */}
        <div class="flex flex-col gap-2">
          <div class="flex min-w-0 items-baseline gap-1.5">
            <h2
              class="min-w-0 truncate font-semibold"
              classList={{ "text-lg": !props.preview, "text-base": props.preview }}
            >
              {props.preview ? (
                props.schema.id
              ) : (
                <A
                  href={lexiconRecordHref(props.schema.id)}
                  class="hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  {props.schema.id}
                </A>
              )}
            </h2>
            <span class="shrink-0 text-sm text-neutral-600 dark:text-neutral-400">
              v{props.schema.lexicon}
            </span>
          </div>
          <Show when={props.schema.description}>
            <p class="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
              {props.schema.description}
            </p>
          </Show>
        </div>

        {/* Definitions */}
        <div
          class="flex flex-col pt-3"
          classList={{ "gap-6": !props.preview, "gap-4": props.preview }}
        >
          <For each={visibleDefinitionEntries()}>
            {([name, def]) => <DefSection name={name} def={def} preview={props.preview} />}
          </For>
          <Show when={props.preview && hiddenDefinitionCount() > 0}>
            <div class="text-xs text-neutral-500 dark:text-neutral-400">
              +{hiddenDefinitionCount()} more definitions
            </div>
          </Show>
        </div>
      </div>
    </LexiconSchemaContext.Provider>
  );
};
