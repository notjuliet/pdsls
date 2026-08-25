import type { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { A } from "@solidjs/router";
import type { Accessor } from "solid-js";
import { createEffect, createSignal, For, Show } from "solid-js";

import { Button } from "../../components/button.jsx";
import { listSpaceBlobs } from "../../lib/spaces.js";
import { ErrorNotice, LoadingState } from "./shared.jsx";

export const SpaceBlobList = (props: {
  auth: Accessor<OAuthUserAgent>;
  space: string;
  repo: string;
  repoPath: string;
}) => {
  const [cids, setCids] = createSignal<string[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let activeKey = "";
  let requestVersion = 0;

  const loadBlobs = async (reset = false, version = requestVersion) => {
    if (loading() && !reset) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await listSpaceBlobs(props.auth(), props.space, props.repo, {
        cursor: reset ? undefined : cursor(),
        limit: 1000,
      });
      if (version !== requestVersion) return;
      setCids((current) => (reset ? result.cids : [...current, ...result.cids]));
      setCursor(result.cursor);
      setLoaded(true);
    } catch (err) {
      if (version !== requestVersion) return;
      setError(err instanceof Error ? err.message : "Could not load Space blobs");
      setLoaded(true);
    } finally {
      if (version === requestVersion) setLoading(false);
    }
  };

  createEffect(() => {
    const key = `${props.auth().sub}\n${props.space}\n${props.repo}`;
    if (key !== activeKey) {
      activeKey = key;
      requestVersion += 1;
      setCids([]);
      setCursor(undefined);
      setLoaded(false);
      setLoading(false);
      setError(undefined);
    }
    if (!loaded() && !loading()) void loadBlobs(true, requestVersion);
  });

  return (
    <div class="flex flex-col items-center gap-2">
      <Show when={loading() && !loaded()}>
        <LoadingState label="Loading blobs…" />
      </Show>

      <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

      <Show when={loaded() && (!error() || cids().length > 0)}>
        <div class="flex w-full flex-col gap-0.5 pb-20 font-mono text-xs sm:text-sm">
          <For each={cids()}>
            {(cid) => (
              <A
                href={`${props.repoPath}/blob/${cid}`}
                state={{ from: `${props.repoPath}#blobs`, label: "Back to blobs" }}
                class="truncate rounded px-0.5 text-left text-blue-500 hover:bg-neutral-200 active:bg-neutral-300 dark:text-blue-400 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                dir="rtl"
              >
                {cid}
              </A>
            )}
          </For>
        </div>

        <div class="bottom-controls-fade dark:bg-dark-500 fixed bottom-0 z-5 flex w-screen justify-center bg-neutral-100 pt-3 pb-6">
          <div class="flex min-w-50 items-center justify-around gap-3">
            <p>
              {cids().length} blob{cids().length === 1 ? "" : "s"}
            </p>
            <Show when={cursor()}>
              <Button
                onClick={() => void loadBlobs()}
                disabled={loading()}
                classList={{ "w-20 h-7.5 justify-center": true }}
              >
                <Show
                  when={!loading()}
                  fallback={<span class="iconify lucide--loader-circle animate-spin text-base" />}
                >
                  Load more
                </Show>
              </Button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};
