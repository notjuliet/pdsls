import { Nsid } from "@atcute/lexicons";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";

import { resolveLexiconAuthority } from "../lib/api.js";

export const LexiconRedirect = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = createSignal<string>();

  createEffect(() => {
    const nsid = params.nsid;
    if (!nsid) return;

    setError(undefined);

    const hash = location.hash || "#schema";
    resolveLexiconAuthority(nsid as Nsid).then(
      (authority) => {
        navigate(`/at://${authority}/com.atproto.lexicon.schema/${nsid}${hash}`, {
          replace: true,
        });
      },
      (err) => {
        console.error("Failed to resolve lexicon authority:", err);
        setError(err instanceof Error ? err.message : "Could not resolve lexicon authority");
      },
    );
  });

  return (
    <div class="mx-2 mt-2 text-neutral-700 dark:text-neutral-300">
      <Show when={error()} fallback="Resolving lexicon schema...">
        {(message) => <>Error during resolution: {message()}</>}
      </Show>
    </div>
  );
};
