import { Nsid } from "@atcute/lexicons";
import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, For, Show } from "solid-js";
import { resolveLexiconAuthority } from "../utils/api.js";

interface LexiconSchema {
  lexicon: number;
  id: string;
  description?: string;
  defs: {
    [key: string]: LexiconDef;
  };
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
  default?: any;
  minimum?: number;
  maximum?: number;
  accept?: string[];
  maxSize?: number;
  knownValues?: string[];
  format?: string;
  // Permission-set fields
  title?: string;
  "title:langs"?: { [lang: string]: string };
  detail?: string;
  "detail:langs"?: { [lang: string]: string };
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

  const handleClick = async () => {
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
        <button
          type="button"
          onClick={handleClick}
          class="inline-block cursor-pointer truncate rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800 hover:bg-blue-200 hover:underline active:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 dark:active:bg-blue-900/50"
        >
          {displayType}
        </button>
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
    <Show when={props.property.minGraphemes !== undefined}>
      <span>minGraphemes: {props.property.minGraphemes}</span>
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
      <Show when={props.property.description && !props.hideNameType}>
        <p class="text-sm wrap-break-word text-neutral-700 dark:text-neutral-300">
          {props.property.description}
        </p>
      </Show>
    </div>
  );
};

const NsidLink = (props: { nsid: string }) => {
  const navigate = useNavigate();

  const handleClick = async () => {
    try {
      const authority = await resolveLexiconAuthority(props.nsid as Nsid);
      navigate(`/at://${authority}/com.atproto.lexicon.schema/${props.nsid}#schema`);
    } catch (err) {
      console.error("Failed to resolve lexicon authority:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      class="cursor-pointer rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-800 hover:bg-blue-200 hover:underline active:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 dark:active:bg-blue-900/50"
    >
      {props.nsid}
    </button>
  );
};

const resourceColor = (resource: string) => {
  switch (resource) {
    case "repo":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "rpc":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    default:
      return "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300";
  }
};

const PermissionRow = (props: { permission: LexiconPermission; index: number }) => {
  return (
    <div class="flex flex-col gap-2 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-mono text-sm font-semibold">#{props.index + 1}</span>
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
          <div class="flex flex-wrap gap-1">
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
          <div class="flex flex-wrap gap-1">
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
      case "permission-set":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300";
      default:
        return "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300";
    }
  };

  const hasDefContent = () =>
    props.def.refs ||
    props.def.minLength !== undefined ||
    props.def.maxLength !== undefined ||
    props.def.maxGraphemes !== undefined ||
    props.def.minGraphemes !== undefined ||
    props.def.minimum !== undefined ||
    props.def.maximum !== undefined ||
    props.def.maxSize !== undefined ||
    props.def.accept ||
    props.def.enum ||
    props.def.const ||
    props.def.default !== undefined ||
    props.def.closed ||
    props.def.items ||
    props.def.knownValues;

  return (
    <div class="flex flex-col gap-3" id={`def-${props.name}`}>
      <div class="group flex items-center gap-2">
        <a href={`#schema:${props.name}`} class="relative text-lg font-semibold hover:underline">
          <span class="iconify lucide--link absolute top-1/2 -left-6 -translate-y-1/2 text-base opacity-0 transition-opacity group-hover:opacity-100" />
          {props.name === "main" ? "Main Definition" : props.name}
        </a>
        <span class={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${defTypeColor()}`}>
          {props.def.type.replace("-", " ")}
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

      {/* Permission-set: Title and Detail */}
      <Show when={props.def.type === "permission-set" && (props.def.title || props.def.detail)}>
        <div class="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50/50 p-3 dark:border-neutral-700 dark:bg-neutral-800/30">
          <Show when={props.def.title}>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-neutral-500 uppercase dark:text-neutral-400">
                Title
              </span>
              <span class="text-sm font-medium">{props.def.title}</span>
            </div>
          </Show>
          <Show when={props.def["title:langs"]}>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-neutral-500 uppercase dark:text-neutral-400">
                Localized Titles
              </span>
              <div class="flex flex-col gap-1">
                <For each={Object.entries(props.def["title:langs"]!)}>
                  {([lang, text]) => (
                    <div class="flex items-center gap-2 text-sm">
                      <span class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800">
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
              <p class="text-sm text-neutral-700 dark:text-neutral-300">{props.def.detail}</p>
            </div>
          </Show>
          <Show when={props.def["detail:langs"]}>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-neutral-500 uppercase dark:text-neutral-400">
                Localized Details
              </span>
              <div class="flex flex-col gap-1">
                <For each={Object.entries(props.def["detail:langs"]!)}>
                  {([lang, text]) => (
                    <div class="flex flex-col gap-1 text-sm">
                      <span class="w-fit rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800">
                        {lang}
                      </span>
                      <p class="text-neutral-700 dark:text-neutral-300">{text}</p>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Permission-set: Permissions list */}
      <Show when={props.def.permissions && props.def.permissions.length > 0}>
        {(() => {
          const supportedPermissions = () =>
            props.def.permissions!.filter((p) => p.resource === "repo" || p.resource === "rpc");
          return (
            <Show when={supportedPermissions().length > 0}>
              <div class="flex flex-col gap-2">
                <h4 class="text-sm font-semibold text-neutral-600 uppercase dark:text-neutral-400">
                  Permissions
                </h4>
                <div class="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/30">
                  <For each={supportedPermissions()}>
                    {(permission, index) => (
                      <PermissionRow permission={permission} index={index()} />
                    )}
                  </For>
                </div>
              </div>
            </Show>
          );
        })()}
      </Show>

      {/* Properties (for record/object types) */}
      <Show
        when={Object.keys(props.def.properties || props.def.record?.properties || {}).length > 0}
      >
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
            <Show
              when={
                props.def.input!.schema?.properties &&
                Object.keys(props.def.input!.schema.properties).length > 0
              }
            >
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
            <Show
              when={
                props.def.output!.schema?.properties &&
                Object.keys(props.def.output!.schema.properties).length > 0
              }
            >
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
          ) && hasDefContent()
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
      requestAnimationFrame(() => {
        const element = document.getElementById(`def-${defName}`);
        if (element) element.scrollIntoView({ behavior: "instant", block: "start" });
      });
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
