import type { ResolvedSchema } from "@atcute/lexicon-resolver";
import type { Nsid } from "@atcute/lexicons";
import { useLocation } from "@solidjs/router";
import { createEffect, createSignal, ErrorBoundary, Show } from "solid-js";

import { LexiconSchemaView } from "../components/lexicon-schema.jsx";
import { resolveLexicon } from "./lexicon.js";

export const useLexiconSchema = (collection: () => string | undefined) => {
  const location = useLocation();
  const [schema, setSchema] = createSignal<ResolvedSchema>();
  const [error, setError] = createSignal<string>();
  const [loading, setLoading] = createSignal(false);

  const showSchema = () => location.hash === "#schema" || location.hash.startsWith("#schema:");

  createEffect(() => {
    const col = collection();
    if (showSchema() && !schema() && !loading() && error() === undefined && col) {
      setLoading(true);
      resolveLexicon(col as Nsid).then(
        (result) => {
          setSchema(result.schema);
          setLoading(false);
        },
        (err) => {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        },
      );
    }
  });

  return { schema, error, loading, showSchema };
};

export const SchemaTabContent = (props: {
  schema?: ResolvedSchema;
  loading: boolean;
  error?: string;
  fallbackSchema?: any;
}) => (
  <>
    <Show when={props.error && !props.fallbackSchema}>
      <span class="mx-2 mt-2">Error during resolution: {props.error}</span>
    </Show>
    <Show when={props.loading && !props.fallbackSchema}>
      <span class="mt-2 text-neutral-700 dark:text-neutral-300">Resolving lexicon schema...</span>
    </Show>
    <Show when={props.schema || props.fallbackSchema}>
      <ErrorBoundary fallback={(err) => <div>Error: {err.message}</div>}>
        <LexiconSchemaView schema={props.fallbackSchema ?? props.schema?.rawSchema} />
      </ErrorBoundary>
    </Show>
  </>
);
