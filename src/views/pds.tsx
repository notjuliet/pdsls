import {
  createSignal,
  For,
  Show,
  type Component,
  createResource,
} from "solid-js";
import { CredentialManager, XRPC } from "@atcute/client";
import { ComAtprotoSyncListRepos } from "@atcute/client/lexicons";
import { A, useParams } from "@solidjs/router";
import { setPDS } from "../main";

const PdsView: Component = () => {
  const params = useParams();
  if (params.pds.startsWith("web%2Bat%3A%2F%2F")) return;
  const [cursor, setCursor] = createSignal<string>();
  setPDS(params.pds);
  const pds =
    params.pds.startsWith("localhost") ?
      `http://${params.pds}`
    : `https://${params.pds}`;
  const rpc = new XRPC({ handler: new CredentialManager({ service: pds }) });

  const listRepos = async (cursor: string | undefined) =>
    await rpc.get("com.atproto.sync.listRepos", {
      params: { limit: 1000, cursor: cursor },
    });

  const fetchRepos = async (): Promise<ComAtprotoSyncListRepos.Repo[]> => {
    const res = await listRepos(cursor());
    setCursor(res.data.repos.length < 1000 ? undefined : res.data.cursor);
    setRepos(repos()?.concat(res.data.repos) ?? res.data.repos);
    return res.data.repos;
  };

  const [response, { refetch }] = createResource(fetchRepos);
  const [repos, setRepos] = createSignal<ComAtprotoSyncListRepos.Repo[]>();

  return (
    <Show when={repos() || response()}>
      <div class="flex flex-col">
        <For each={repos()}>
          {(repo) => (
            <A
              href={`/at/${repo.did}`}
              classList={{
                "hover:underline w-fit font-mono relative": true,
                "text-lightblue-500": repo.active,
                "text-gray-300 dark:text-gray-600": !repo.active,
              }}
            >
              <span class="absolute -left-5 font-sans">
                {!repo.active ? "🪦" : ""}
              </span>
              {repo.did}
            </A>
          )}
        </For>
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
    </Show>
  );
};

export { PdsView };
