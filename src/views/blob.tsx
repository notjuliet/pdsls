import { Client, simpleFetchHandler } from "@atcute/client";
import { createResource, createSignal, For, Show } from "solid-js";
import { Button } from "../components/button";

const LIMIT = 1000;

const BlobView = (props: { pds: string; repo: string }) => {
  const [cursor, setCursor] = createSignal<string>();
  let rpc: Client;

  const fetchBlobs = async () => {
    if (!rpc) rpc = new Client({ handler: simpleFetchHandler({ service: props.pds }) });
    const res = await rpc.get("com.atproto.sync.listBlobs", {
      params: {
        did: props.repo as `did:${string}:${string}`,
        limit: LIMIT,
        cursor: cursor(),
      },
    });
    if (!res.ok) throw new Error(res.data.error);
    if (!res.data.cids) return [];
    setCursor(res.data.cids.length < LIMIT ? undefined : res.data.cursor);
    setBlobs(blobs()?.concat(res.data.cids) ?? res.data.cids);
    return res.data.cids;
  };

  const [response, { refetch }] = createResource(fetchBlobs);
  const [blobs, setBlobs] = createSignal<string[]>();

  return (
    <div class="flex flex-col items-center gap-2">
      <Show when={blobs() || response()}>
        <div class="flex w-full flex-col gap-0.5 pb-20 font-mono text-xs sm:text-sm">
          <For each={blobs()}>
            {(cid) => (
              <a
                href={`${props.pds}/xrpc/com.atproto.sync.getBlob?did=${props.repo}&cid=${cid}`}
                target="_blank"
                class="truncate rounded px-0.5 text-left text-blue-500 hover:bg-neutral-200 active:bg-neutral-300 dark:text-blue-400 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                dir="rtl"
              >
                {cid}
              </a>
            )}
          </For>
        </div>
      </Show>
      <div class="dark:bg-dark-500 fixed bottom-0 z-5 flex w-screen justify-center bg-neutral-100 pt-2 pb-4">
        <div class="flex flex-col items-center gap-1 pb-2">
          <p>
            {blobs()?.length} blob{(blobs()?.length ?? 0 > 1) ? "s" : ""}
          </p>
          <Show when={cursor()}>
            <Button
              onClick={() => refetch()}
              disabled={response.loading}
              classList={{ "w-20 justify-center": true }}
            >
              <Show
                when={!response.loading}
                fallback={<span class="iconify lucide--loader-circle animate-spin text-base" />}
              >
                Load more
              </Show>
            </Button>
          </Show>
        </div>
      </div>
    </div>
  );
};

export { BlobView };
