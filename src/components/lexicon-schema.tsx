import type { Nsid } from "@atcute/lexicons";
import type { AtprotoDid } from "@atcute/lexicons/syntax";
import { A, useLocation } from "@solidjs/router";
import { createContext, createEffect, For, type JSX, Show, useContext } from "solid-js";

import { parseLexiconRef, resolveLexicon, schemaHash, schemaHref } from "../lib/lexicon";
import HoverCard, { HoverCardError } from "./hover-card/base";
import { createHoverResource } from "./hover-card/resource";
import Tooltip from "./tooltip.jsx";

// Style constants
const CONTAINER_CLASS =
  "divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/30";

const CARD_CLASS =
  "flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 dark:border-neutral-700 dark:bg-neutral-800/30";

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
  property.knownValues ||
  property.closed;

const LexiconSchemaContext = createContext<{ inertRefs?: boolean }>();
const useLexiconSchemaContext = () => useContext(LexiconSchemaContext) ?? {};

const schemaDefId = (defName: string) => `schema:${defName}`;
const SCHEMA_REF_TEXT_CLASS = "font-mono text-xs wrap-break-word text-blue-500 dark:text-blue-400";
const SCHEMA_LINK_CLASS = `${SCHEMA_REF_TEXT_CLASS} cursor-pointer hover:underline`;

const keepLocalHashNavigationNative = (event: MouseEvent) => event.stopPropagation();

const LocalSchemaLink = (props: { defName: string; class: string; children: JSX.Element }) => (
  <a href={schemaHash(props.defName)} on:click={keepLocalHashNavigationNative} class={props.class}>
    {props.children}
  </a>
);

const SchemaRefLink = (props: { refType: string; children: JSX.Element }) => {
  const context = useLexiconSchemaContext();

  if (context.inertRefs) {
    return <span class={SCHEMA_REF_TEXT_CLASS}>{props.children}</span>;
  }

  if (props.refType.startsWith("#")) {
    return (
      <LocalSchemaLink defName={props.refType.slice(1)} class={SCHEMA_LINK_CLASS}>
        {props.children}
      </LocalSchemaLink>
    );
  }

  return <SchemaRefHoverCard refType={props.refType}>{props.children}</SchemaRefHoverCard>;
};

export interface LexiconSchema {
  lexicon: number;
  id: string;
  description?: string;
  defs: {
    [key: string]: LexiconDef;
  };
}

interface LexiconPreviewState {
  authority: AtprotoDid;
  schema: LexiconSchema;
}

const fetchLexiconPreview = async (nsid: string): Promise<LexiconPreviewState> => {
  const { authority, schema } = await resolveLexicon(nsid as Nsid);
  return { authority, schema: schema.rawSchema as LexiconSchema };
};

function SchemaRefHoverCard(props: { refType: string; children: JSX.Element }) {
  const parsed = () => parseLexiconRef(props.refType);
  const preview = createHoverResource(() => parsed().nsid, fetchLexiconPreview, {
    getErrorMessage: (err) => (err instanceof Error ? err.message : "Failed to resolve schema"),
  });
  const loading = preview.visibleLoading;
  const hasPreview = () => Boolean(preview.state().data || preview.state().error);
  const trigger = () => (
    <A
      href={schemaHref(parsed().nsid, parsed().defName)}
      class={SCHEMA_LINK_CLASS}
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
      class="inline text-xs leading-4"
      previewClass="max-h-[32rem] w-[min(36rem,calc(100vw-2rem))] font-sans text-sm"
      showPreview={hasPreview()}
    >
      <Show when={preview.state().error}>
        <HoverCardError message={preview.state().error} />
      </Show>
      <Show when={preview.state().data}>
        {(data) => (
          <LexiconSchemaView
            schema={data().schema}
            authority={data().authority}
            preview
            inertRefs
            focusDef={parsed().defName}
          />
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

const TypeBadge = (props: { type: string; format?: string; refType?: string }) => {
  const displayType = props.refType
    ? props.refType.replace(/^#/, "")
    : props.format
      ? `${props.type}:${props.format}`
      : props.type;

  return (
    <Show
      when={props.refType}
      fallback={
        <span class="font-mono text-xs text-neutral-600 dark:text-neutral-400">{displayType}</span>
      }
    >
      <SchemaRefLink refType={props.refType!}>{displayType}</SchemaRefLink>
    </Show>
  );
};

const UnionBadges = (props: { refs: string[] }) => (
  <div class="flex flex-col items-start gap-1">
    <For each={props.refs}>{(refType) => <TypeBadge type="union" refType={refType} />}</For>
  </div>
);

const ConstraintsList = (props: { property: LexiconProperty }) => {
  const valueClass = "text-neutral-600 dark:text-neutral-400";
  return (
    <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <Show when={props.property.minLength !== undefined}>
        <span>
          minLength: <span class={valueClass}>{props.property.minLength}</span>
        </span>
      </Show>
      <Show when={props.property.maxLength !== undefined}>
        <span>
          maxLength: <span class={valueClass}>{props.property.maxLength}</span>
        </span>
      </Show>
      <Show when={props.property.maxGraphemes !== undefined}>
        <span>
          maxGraphemes: <span class={valueClass}>{props.property.maxGraphemes}</span>
        </span>
      </Show>
      <Show when={props.property.minGraphemes !== undefined}>
        <span>
          minGraphemes: <span class={valueClass}>{props.property.minGraphemes}</span>
        </span>
      </Show>
      <Show when={props.property.minimum !== undefined}>
        <span>
          min: <span class={valueClass}>{props.property.minimum}</span>
        </span>
      </Show>
      <Show when={props.property.maximum !== undefined}>
        <span>
          max: <span class={valueClass}>{props.property.maximum}</span>
        </span>
      </Show>
      <Show when={props.property.maxSize !== undefined}>
        <span>
          maxSize: <span class={valueClass}>{props.property.maxSize}</span>
        </span>
      </Show>
      <Show when={props.property.accept}>
        <span>
          accept: <span class={valueClass}>[{props.property.accept!.join(", ")}]</span>
        </span>
      </Show>
      <Show when={props.property.enum}>
        <span>
          enum: <span class={valueClass}>[{props.property.enum!.join(", ")}]</span>
        </span>
      </Show>
      <Show when={props.property.const}>
        <span>
          const: <span class={valueClass}>{props.property.const?.toString()}</span>
        </span>
      </Show>
      <Show when={props.property.default !== undefined}>
        <span>
          default: <span class={valueClass}>{JSON.stringify(props.property.default)}</span>
        </span>
      </Show>
      <Show when={props.property.knownValues}>
        <span>
          knownValues: <span class={valueClass}>[{props.property.knownValues!.join(", ")}]</span>
        </span>
      </Show>
      <Show when={props.property.closed}>
        <span>
          closed: <span class={valueClass}>true</span>
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
}) => {
  return (
    <div class="flex flex-col gap-2 py-3">
      <Show when={!props.hideNameType}>
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="font-semibold">{props.name}</span>
          <Show when={!props.property.refs}>
            <TypeBadge
              type={props.property.type}
              format={props.property.format}
              refType={props.property.ref}
            />
          </Show>
          <Show when={props.property.refs}>
            <span class="font-mono text-xs text-neutral-600 dark:text-neutral-400">union</span>
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
          <div class="flex items-baseline gap-2 text-xs">
            <span class="font-medium">items:</span>
            <Show when={!props.property.items!.refs}>
              <TypeBadge
                type={props.property.items!.type}
                format={props.property.items!.format}
                refType={props.property.items!.ref}
              />
            </Show>
            <Show when={props.property.items!.refs}>
              <span class="font-mono text-xs text-neutral-600 dark:text-neutral-400">union</span>
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

const SchemaSection = (props: { title: string; encoding: string; schema?: LexiconObject }) => {
  return (
    <div class="flex flex-col gap-2">
      <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
        {props.title}
      </h4>
      <div class={CARD_CLASS}>
        <div class="text-sm">
          <span class="font-semibold">Encoding: </span>
          <span class="font-mono">{props.encoding}</span>
        </div>
        <Show when={props.schema?.ref}>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold">Schema:</span>
            <TypeBadge type="ref" refType={props.schema!.ref} />
          </div>
        </Show>
        <Show when={props.schema?.refs}>
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold">Schema (union):</span>
            </div>
            <UnionBadges refs={props.schema!.refs!} />
          </div>
        </Show>
        <Show when={props.schema?.properties && Object.keys(props.schema.properties).length > 0}>
          <div class={CONTAINER_CLASS}>
            <For each={Object.entries(props.schema!.properties!)}>
              {([name, property]) => (
                <PropertyRow
                  name={name}
                  property={property}
                  required={(props.schema?.required || []).includes(name)}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
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
        <span class={`rounded px-2 py-0.5 text-xs font-semibold ${defTypeColor()}`}>
          <span class="uppercase">{props.def.type.replace("-", " ")}</span>
          <Show when={props.def.key}>
            <span class=""> · {props.def.key}</span>
          </Show>
        </span>
      </div>

      <Show when={props.def.description}>
        <p class="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
          {props.def.description}
        </p>
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
          <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
            Permissions
          </h4>
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
          <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
            Properties
          </h4>
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
          <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
            Parameters
          </h4>
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
        <SchemaSection
          title="Input"
          encoding={props.def.input!.encoding}
          schema={props.def.input!.schema}
        />
      </Show>

      {/* Output */}
      <Show when={props.def.output}>
        <SchemaSection
          title="Output"
          encoding={props.def.output!.encoding}
          schema={props.def.output!.schema}
        />
      </Show>

      {/* Errors */}
      <Show when={props.def.errors && props.def.errors.length > 0}>
        <div class="flex flex-col gap-2">
          <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
            Errors
          </h4>
          <div class={CONTAINER_CLASS}>
            <For each={props.def.errors}>
              {(error) => (
                <div class="flex flex-col gap-1 py-2">
                  <div class="font-semibold">{error.name}</div>
                  <Show when={error.description}>
                    <p class="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
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

export const LexiconSchemaView = (props: {
  schema: LexiconSchema;
  authority?: AtprotoDid;
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
      if (visible.size >= 3) break;
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
          <div class="flex min-w-0 items-center gap-1.5">
            <h2
              class="min-w-0 truncate font-semibold"
              classList={{ "text-lg": !props.preview, "text-base": props.preview }}
            >
              {props.schema.id}
            </h2>
            <span class="shrink-0 text-sm text-neutral-600 dark:text-neutral-400">
              v{props.schema.lexicon}
            </span>
            <Show when={props.authority && !props.preview}>
              <Tooltip text="View record">
                <A
                  href={`/at://${props.authority}/com.atproto.lexicon.schema/${props.schema.id}`}
                  class="flex shrink-0 items-center p-1 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                  target="_blank"
                >
                  <span class="iconify lucide--external-link text-sm"></span>
                </A>
              </Tooltip>
            </Show>
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
