import {
  createResource,
  createSignal,
  For,
  Show,
  type Component,
} from "solid-js";
import { CredentialManager, XRPC } from "@atcute/client";
import { query, useParams } from "@solidjs/router";
import { resolvePDS } from "../utils/api.js";
import { resolveHandle } from "@atcute/oauth-browser-client";

const BlobView: Component = () => {
  const params = useParams();
  const [cursor, setCursor] = createSignal<string>();
  let did = params.repo;
  let pds: string;
  let rpc: XRPC;

  const listBlobs = query(
    (did: string, cursor: string | undefined) =>
      rpc.get("com.atproto.sync.listBlobs", {
        params: {
          did: did as `did:${string}`,
          limit: 1000,
          cursor: cursor,
        },
      }),
    "listBlobs",
  );

  const fetchBlobs = async (): Promise<string[]> => {
    if (!did.startsWith("did:")) did = await resolveHandle(params.repo);
    if (!pds) pds = await resolvePDS(did);
    if (!rpc)
      rpc = new XRPC({ handler: new CredentialManager({ service: pds }) });
    const res = await listBlobs(did, cursor());
    setCursor(res.data.cids.length < 1000 ? undefined : res.data.cursor);
    setBlobs(blobs()?.concat(res.data.cids) ?? res.data.cids);
    return res.data.cids;
  };

  const [response, { refetch }] = createResource(fetchBlobs);
  const [blobs, setBlobs] = createSignal<string[]>();

  return (
    <div class="flex flex-col items-center">
      <Show when={blobs() || response()}>
        <div class="break-anywhere flex flex-col font-mono">
          <For each={blobs()}>
            {(cid) => (
              <a
                href={`${pds}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`}
                target="_blank"
                class="hover:bg-neutral-300 dark:hover:bg-neutral-700"
              >
                <span class="text-lightblue-500">{cid}</span>
              </a>
            )}
          </For>
        </div>
      </Show>
      <Show when={cursor()}>
        <button
          type="button"
          onclick={() => refetch()}
          class="dark:bg-dark-700 dark:hover:bg-dark-800 mt-1 rounded-lg border border-gray-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          Load More
        </button>
      </Show>
    </div>
  );
};

export { BlobView };
