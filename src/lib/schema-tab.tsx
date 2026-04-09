import { ResolvedSchema } from "@atcute/lexicon-resolver";
import { Nsid } from "@atcute/lexicons";
import { AtprotoDid } from "@atcute/lexicons/syntax";
import { useLocation } from "@solidjs/router";
import { createEffect, createSignal, ErrorBoundary, Show } from "solid-js";
import { LexiconSchemaView } from "../components/lexicon-schema.jsx";
import { resolveLexiconAuthority, resolveLexiconSchema } from "./api.js";

interface CachedLexicon {
  authority: AtprotoDid;
  schema: ResolvedSchema;
}

const cache = new Map<string, Promise<CachedLexicon>>();

const resolve = (nsid: Nsid): Promise<CachedLexicon> => {
  let cached = cache.get(nsid);
  if (cached) return cached;

  const promise = (async () => {
    const authority = await resolveLexiconAuthority(nsid);
    const schema = await resolveLexiconSchema(authority, nsid);
    return { authority, schema };
  })();

  cache.set(nsid, promise);
  promise.catch(() => cache.delete(nsid));
  return promise;
};

export const useLexiconSchema = (collection: () => string | undefined) => {
  const location = useLocation();
  const [schema, setSchema] = createSignal<ResolvedSchema>();
  const [authority, setAuthority] = createSignal<AtprotoDid>();
  const [error, setError] = createSignal<string>();
  const [loading, setLoading] = createSignal(false);

  const showSchema = () => location.hash === "#schema" || location.hash.startsWith("#schema:");

  createEffect(() => {
    const col = collection();
    if (showSchema() && !schema() && !loading() && error() === undefined && col) {
      setLoading(true);
      resolve(col as Nsid).then(
        (result) => {
          setAuthority(result.authority);
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

  return { schema, authority, error, loading, showSchema };
};

export const SchemaTabContent = (props: {
  schema?: ResolvedSchema;
  authority?: AtprotoDid;
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
        <LexiconSchemaView
          schema={props.fallbackSchema ?? props.schema?.rawSchema}
          authority={props.authority}
        />
      </ErrorBoundary>
    </Show>
  </>
);
