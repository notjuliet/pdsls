import { A } from "@solidjs/router";
import { For, Show } from "solid-js";

import { InfoRow, InfoSection, MUTED_CLASS } from "../../components/ui/info.jsx";
import { schemaHref } from "../../lib/lexicon.js";

export interface SpaceTypeInfo {
  name?: string;
  description?: string;
  key?: string;
  collections?: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const localizedName = (fallback: string | undefined, value: unknown) => {
  if (!isObject(value)) return fallback;

  for (const language of navigator.languages) {
    const exact = value[language];
    if (typeof exact === "string") return exact;

    const base = value[language.split("-")[0]];
    if (typeof base === "string") return base;
  }

  return fallback;
};

export const parseSpaceTypeInfo = (schema: unknown): SpaceTypeInfo => {
  if (!isObject(schema) || !isObject(schema.defs) || !isObject(schema.defs.main)) {
    throw new Error("The resolved Lexicon is not a Space type declaration");
  }

  const main = schema.defs.main;
  if (main.type !== "space") {
    throw new Error("The resolved Lexicon is not a Space type declaration");
  }

  return {
    name: localizedName(typeof main.name === "string" ? main.name : undefined, main["name:lang"]),
    description: typeof main.description === "string" ? main.description : undefined,
    key: typeof main.key === "string" ? main.key : undefined,
    collections: Array.isArray(main.collections)
      ? main.collections.filter(
          (collection): collection is string => typeof collection === "string",
        )
      : undefined,
  };
};

export const SpaceTypeDetails = (props: {
  info?: SpaceTypeInfo;
  loading: boolean;
  error?: string;
}) => (
  <InfoSection title="About">
    <div class="flex flex-col gap-1">
      <Show when={props.info?.name}>{(name) => <InfoRow label="Name">{name()}</InfoRow>}</Show>
      <Show when={props.info?.description}>
        {(description) => <InfoRow label="Description">{description()}</InfoRow>}
      </Show>
      <Show when={props.info?.key}>{(key) => <InfoRow label="Key">{key()}</InfoRow>}</Show>
      <Show when={props.info?.collections}>
        {(collections) => (
          <InfoRow label="Collections">
            <span class="flex flex-col">
              <For each={collections()}>
                {(collection) => (
                  <A
                    href={schemaHref(collection)}
                    class="w-fit text-blue-500 hover:underline dark:text-blue-400"
                  >
                    {collection}
                  </A>
                )}
              </For>
            </span>
          </InfoRow>
        )}
      </Show>
      <Show when={props.loading}>
        <p class={`text-sm ${MUTED_CLASS}`}>Resolving type declaration…</p>
      </Show>
      <Show when={props.error}>
        {(message) => <p class="text-sm text-red-500 dark:text-red-400">{message()}</p>}
      </Show>
    </div>
  </InfoSection>
);
