import type { Nsid } from "@atcute/lexicons";
import { A, useLocation } from "@solidjs/router";
import { createContext, createEffect, For, type JSX, Show, useContext } from "solid-js";

import { formatSizeLimit } from "../lib/format";
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
/**
 * A list of properties, errors or permissions: rows between faint hairlines, lighter than the
 * rules between definitions, with none above the first. It's a container, so its rows split into
 * two columns when it has the room, in a hover card as on the page.
 */
const CONTAINER_CLASS = "@container divide-y divide-neutral-200/80 dark:divide-neutral-700/50";

const SECTION_HEADING_CLASS = "text-sm font-medium text-neutral-500 dark:text-neutral-400";

/** A muted label line under a heading, like "Record key:" or "Encoding:". */
const INFO_LINE_CLASS = "w-fit text-sm text-neutral-500 dark:text-neutral-400";

/** A value after a muted label, like a constraint's or the record key's. */
const VALUE_CLASS = "text-neutral-700 dark:text-neutral-300";

const DESCRIPTION_CLASS = "text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300";

const RESOURCE_COLORS = {
  repo: "bg-green-500/10 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  rpc: "bg-purple-500/10 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
  default: "bg-neutral-500/10 text-neutral-700 dark:bg-neutral-400/10 dark:text-neutral-300",
} as const;

/**
 * A definition's type badge colour. Objects are left out, so they take the neutral default: most
 * definitions in a big lexicon are objects, and colour is kept for the kinds worth spotting.
 */
const DEF_TYPE_COLORS = {
  record: "bg-green-500/10 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  query: "bg-purple-500/10 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
  procedure: "bg-orange-500/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400",
  subscription: "bg-pink-500/10 text-pink-700 dark:bg-pink-400/10 dark:text-pink-400",
  token: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-400",
  "permission-set": "bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-400",
  default: "bg-neutral-500/10 text-neutral-700 dark:bg-neutral-400/10 dark:text-neutral-300",
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
  /** Larger on a line of its own, e.g. an input's "Schema:". */
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

/** A constraint as a muted label and its value, with the exact value on hover when it's rounded. */
const Constraint = (props: { label: string; title?: string; children: JSX.Element }) => (
  <span title={props.title}>
    {props.label}: <span class={VALUE_CLASS}>{props.children}</span>
  </span>
);

/** A count or bound with thousands separators, e.g. 3,000 rather than 3000. */
const formatCount = (value: number) => value.toLocaleString("en");

const ConstraintsList = (props: { property: LexiconProperty }) => {
  return (
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
      <Show when={props.property.minLength !== undefined}>
        <Constraint label="minLength">{formatCount(props.property.minLength!)}</Constraint>
      </Show>
      <Show when={props.property.maxLength !== undefined}>
        <Constraint label="maxLength">{formatCount(props.property.maxLength!)}</Constraint>
      </Show>
      <Show when={props.property.maxGraphemes !== undefined}>
        <Constraint label="maxGraphemes">{formatCount(props.property.maxGraphemes!)}</Constraint>
      </Show>
      <Show when={props.property.minGraphemes !== undefined}>
        <Constraint label="minGraphemes">{formatCount(props.property.minGraphemes!)}</Constraint>
      </Show>
      <Show when={props.property.minimum !== undefined}>
        <Constraint label="min">{formatCount(props.property.minimum!)}</Constraint>
      </Show>
      <Show when={props.property.maximum !== undefined}>
        <Constraint label="max">{formatCount(props.property.maximum!)}</Constraint>
      </Show>
      <Show when={props.property.maxSize !== undefined}>
        <Constraint label="maxSize" title={`${formatCount(props.property.maxSize!)} bytes`}>
          {formatSizeLimit(props.property.maxSize!)}
        </Constraint>
      </Show>
      <Show when={props.property.accept}>
        <Constraint label="accept">{props.property.accept!.join(", ")}</Constraint>
      </Show>
      <Show when={props.property.enum}>
        <Constraint label="enum">{props.property.enum!.join(", ")}</Constraint>
      </Show>
      <Show when={props.property.const}>
        <Constraint label="const">{props.property.const?.toString()}</Constraint>
      </Show>
      <Show when={props.property.default !== undefined}>
        <Constraint label="default">{JSON.stringify(props.property.default)}</Constraint>
      </Show>
      <Show when={props.property.knownValues}>
        <Constraint label="knownValues">{props.property.knownValues!.join(", ")}</Constraint>
      </Show>
    </div>
  );
};

/** Amber-700 in light mode, since 600 is too faint to read at this size on the grey background. */
const REQUIRED_CLASS = "text-xs text-amber-700 dark:text-amber-500";

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
    // The name, type and "required" in a narrow column, and what the value is beside it. Stacked
    // when the list is too narrow for both, with the description straight under the name.
    <div
      class={`grid gap-x-6 gap-y-1.5 ${props.class ?? "py-2"}`}
      classList={{ "@md:grid-cols-[11rem_minmax(0,1fr)]": !props.hideNameType }}
    >
      <Show when={!props.hideNameType}>
        <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 @md:flex-col">
          {/* In the narrow column, "required" goes with the name, which is short, rather than the
              type, which can be long enough to push it onto a third line. Stacked, it reads
              after the type instead, as "text string required". */}
          <span class="flex flex-wrap items-baseline gap-x-2">
            <span class="font-mono text-sm font-semibold wrap-break-word">{props.name}</span>
            <Show when={props.required}>
              <span class={`hidden @md:inline ${REQUIRED_CLASS}`}>required</span>
            </Show>
          </span>
          <Show when={!props.property.refs}>
            <TypeBadge
              type={props.property.type}
              format={props.property.format}
              refType={props.property.ref}
            />
          </Show>
          <Show when={props.property.refs}>
            <TypeBadge type={unionType(props.property)} />
          </Show>
          <Show when={props.required}>
            <span class={`@md:hidden ${REQUIRED_CLASS}`}>required</span>
          </Show>
        </div>
      </Show>
      <div class="flex min-w-0 flex-col gap-2">
        <Show when={props.property.description && !props.hideNameType}>
          <p class="text-sm wrap-break-word whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
            {props.property.description}
          </p>
        </Show>
        {/* Labelled and nested like an array's items, so the types don't read as more prose. */}
        <Show when={props.property.refs}>
          <div class="flex flex-col gap-2">
            <span class="text-xs text-neutral-500 dark:text-neutral-400">refs:</span>
            <div class="ml-1 border-l border-neutral-300 pl-3 dark:border-neutral-600">
              <UnionBadges refs={props.property.refs!} current={props.currentType} />
            </div>
          </div>
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
      </div>
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
        Encoding: <span class={`font-mono ${VALUE_CLASS}`}>{props.body.encoding}</span>
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
    <div class="flex flex-col gap-2 py-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-semibold">#{props.index + 1}</span>
        <span
          class={`rounded px-1.5 py-0.5 font-mono text-xs font-medium ${resourceColor(props.permission.resource)}`}
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

/** A permission set's title or detail, then each translation of it labelled with its language. */
const localizedLines = (label: string, text?: string, translations?: Record<string, string>) => [
  ...(text ? [{ label, text }] : []),
  ...Object.entries(translations ?? {}).map(([lang, text]) => ({
    label: `${label} (${lang})`,
    text,
  })),
];

const DefSection = (props: {
  name: string;
  def: LexiconDef;
  preview?: boolean;
  /** Shown small on the right of the heading, e.g. the lexicon's name on the first definition. */
  aside?: JSX.Element;
}) => {
  const defTypeColor = () =>
    DEF_TYPE_COLORS[props.def.type as keyof typeof DEF_TYPE_COLORS] || DEF_TYPE_COLORS.default;

  const hasDefContent = () => props.def.refs || props.def.items || hasConstraints(props.def);

  return (
    // Its sections further apart than the rows in them, so each list reads as one group.
    <div
      class="flex scroll-mt-4 flex-col"
      classList={{
        "gap-4": !props.preview,
        "gap-3": props.preview,
      }}
      id={schemaDefId(props.name)}
    >
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-4">
          <div class="group flex shrink-0 items-center gap-2">
            <LocalSchemaLink defName={props.name} class="relative font-semibold hover:underline">
              <span class="iconify lucide--link absolute top-1/2 -left-6 -translate-y-1/2 text-base opacity-0 transition-opacity group-hover:opacity-100" />
              {props.name === "main" ? "Main Definition" : props.name}
            </LocalSchemaLink>
            <span class={`rounded px-1.5 py-0.5 font-mono text-xs font-medium ${defTypeColor()}`}>
              {props.def.type}
            </span>
          </div>
          <Show when={props.aside}>
            {/* Cut short before it can push the heading onto a second line. */}
            <div class="ml-auto min-w-0 truncate">{props.aside}</div>
          </Show>
        </div>

        <Show when={props.def.key}>
          {(key) => (
            <span class={INFO_LINE_CLASS} title={describeRecordKey(key())}>
              Record key: <span class={`font-mono ${VALUE_CLASS}`}>{key()}</span>
            </span>
          )}
        </Show>

        <Show when={props.def.description}>
          <p class={DESCRIPTION_CLASS}>{props.def.description}</p>
        </Show>

        {/* Permission-set: the title and detail an app shows when asking for it, with translations */}
        <Show when={props.def.type === "permission-set"}>
          <For each={localizedLines("Title", props.def.title, props.def["title:lang"])}>
            {(line) => (
              <span class={INFO_LINE_CLASS}>
                {line.label}: <span class={`whitespace-pre-wrap ${VALUE_CLASS}`}>{line.text}</span>
              </span>
            )}
          </For>
          <For each={localizedLines("Detail", props.def.detail, props.def["detail:lang"])}>
            {(line) => (
              <span class={INFO_LINE_CLASS}>
                {line.label}: <span class={`whitespace-pre-wrap ${VALUE_CLASS}`}>{line.text}</span>
              </span>
            )}
          </For>
        </Show>
      </div>

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
                <div class="grid gap-x-6 gap-y-1 py-2 @md:grid-cols-[11rem_minmax(0,1fr)]">
                  <div class="font-mono text-sm font-semibold wrap-break-word">{error.name}</div>
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

  // The lexicon language's version, not the schema's, so it's left out while it's the only one, 1:
  // next to the name it reads as a revision of the schema, which lexicons don't have.
  const version = () => (props.schema.lexicon !== 1 ? `v${props.schema.lexicon}` : undefined);

  const lexiconLink = () => (
    <A
      href={lexiconRecordHref(props.schema.id)}
      class="font-mono text-xs text-neutral-500 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-neutral-400"
    >
      {props.schema.id}
      {version() && ` ${version()}`}
    </A>
  );

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
        {/* Header. On the page, the name is already above the tabs, so it moves to the right of
            the first definition's heading, small, and only the description stays here. */}
        <Show when={props.preview}>
          <div class="flex min-w-0 items-baseline gap-1.5">
            <h2 class="min-w-0 truncate text-base font-semibold">{props.schema.id}</h2>
            <Show when={version()}>
              <span class="shrink-0 text-sm text-neutral-600 dark:text-neutral-400">
                {version()}
              </span>
            </Show>
          </div>
        </Show>
        <Show when={props.schema.description}>
          <p
            class="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300"
            classList={{ "pt-2": props.preview }}
          >
            {props.schema.description}
          </p>
        </Show>

        {/* Definitions, with a rule between them stronger than the lines between rows */}
        <div
          class="flex flex-col"
          classList={{
            "gap-6 [&>*+*]:border-t [&>*+*]:border-neutral-300 [&>*+*]:pt-6 dark:[&>*+*]:border-neutral-700":
              !props.preview,
            "pt-4": !props.preview && !!props.schema.description,
            "pt-3 gap-4": props.preview,
          }}
        >
          <For each={visibleDefinitionEntries()}>
            {([name, def], index) => (
              <DefSection
                name={name}
                def={def}
                preview={props.preview}
                aside={!props.preview && index() === 0 ? lexiconLink() : undefined}
              />
            )}
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
