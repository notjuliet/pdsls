import { A } from "@solidjs/router";
import { For, Show } from "solid-js";

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
  <section class="flex flex-col gap-2 px-2">
    <dl class="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-sm">
      <Show when={props.info?.name}>
        <dt class="text-neutral-500 dark:text-neutral-400">Name</dt>
        <dd>{props.info!.name}</dd>
      </Show>

      <Show when={props.info?.description}>
        <dt class="text-neutral-500 dark:text-neutral-400">Description</dt>
        <dd>{props.info!.description}</dd>
      </Show>

      <Show when={props.info?.key}>
        <dt class="text-neutral-500 dark:text-neutral-400">Key</dt>
        <dd>{props.info!.key}</dd>
      </Show>

      <Show when={props.info?.collections}>
        {(collections) => (
          <>
            <dt class="text-neutral-500 dark:text-neutral-400">Collections</dt>
            <dd class="min-w-0">
              <ul class="flex flex-col gap-1 wrap-anywhere">
                <For each={collections()}>
                  {(collection) => (
                    <li>
                      <A
                        href={schemaHref(collection)}
                        class="text-blue-500 hover:underline dark:text-blue-400"
                      >
                        {collection}
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            </dd>
          </>
        )}
      </Show>
    </dl>

    <Show when={props.loading}>
      <p class="text-xs text-neutral-500 dark:text-neutral-400">Resolving type declaration…</p>
    </Show>
    <Show when={props.error}>
      {(message) => <p class="text-xs text-red-500 dark:text-red-400">{message()}</p>}
    </Show>
  </section>
);
