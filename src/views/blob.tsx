import { createResource, createSignal, For, Show } from "solid-js";
import { Client, CredentialManager } from "@atcute/client";

const LIMIT = 1000;

const BlobView = (props: { pds: string; repo: string }) => {
  const [cursor, setCursor] = createSignal<string>();
  let rpc: Client;

  const listBlobs = (did: string, cursor: string | undefined) =>
    rpc.get("com.atproto.sync.listBlobs", {
      params: {
        did: did as `did:${string}:${string}`,
        limit: LIMIT,
        cursor: cursor,
      },
    });

  const fetchBlobs = async () => {
    if (!rpc) rpc = new Client({ handler: new CredentialManager({ service: props.pds }) });
    const res = await listBlobs(props.repo, cursor());
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
        <p>
          {blobs()?.length} blob{(blobs()?.length ?? 0 > 1) ? "s" : ""}
        </p>
        <div class="break-anywhere flex flex-col gap-0.5 font-mono text-sm lg:break-normal">
          <For each={blobs()}>
            {(cid) => (
              <a
                href={`${props.pds}/xrpc/com.atproto.sync.getBlob?did=${props.repo}&cid=${cid}`}
                target="_blank"
                class="rounded px-0.5 hover:bg-zinc-200 dark:hover:bg-neutral-700"
              >
                <span class="text-blue-400">{cid}</span>
              </a>
            )}
          </For>
        </div>
      </Show>
      <Show when={cursor() && !response.loading}>
        <button
          type="button"
          onclick={() => refetch()}
          class="dark:hover:bg-dark-100 dark:bg-dark-300 focus:outline-1.5 rounded-lg bg-white px-2 py-1.5 text-xs font-bold shadow-md hover:bg-zinc-100 focus:outline-blue-500"
        >
          Load More
        </button>
      </Show>
      <Show when={response.loading}>
        <div class="i-lucide-loader-circle mt-2 animate-spin text-xl" />
      </Show>
    </div>
  );
};

export { BlobView };
