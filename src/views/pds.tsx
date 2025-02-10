import { createSignal, For, Show, createResource } from "solid-js";
import { CredentialManager, XRPC } from "@atcute/client";
import { ComAtprotoSyncListRepos } from "@atcute/client/lexicons";
import { A, useParams } from "@solidjs/router";
import { setPDS } from "../components/navbar";
import Tooltip from "../components/tooltip";

const PdsView = () => {
  const params = useParams();
  if (params.pds.startsWith("web%2Bat%3A%2F%2F")) return;
  const [version, setVersion] = createSignal<string>();
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

  const getVersion = async () => {
    // @ts-expect-error: undocumented endpoint
    const res = await rpc.get("_health", {});
    setVersion((res.data as any).version);
  };

  const fetchRepos = async (): Promise<ComAtprotoSyncListRepos.Repo[]> => {
    const res = await listRepos(cursor());
    setCursor(res.data.repos.length < 1000 ? undefined : res.data.cursor);
    setRepos(repos()?.concat(res.data.repos) ?? res.data.repos);
    await getVersion();
    return res.data.repos;
  };

  const [response, { refetch }] = createResource(fetchRepos);
  const [repos, setRepos] = createSignal<ComAtprotoSyncListRepos.Repo[]>();

  return (
    <Show when={repos() || response()}>
      <div class="mt-3 flex flex-col">
        <Show when={version()}>
          <div class="flex max-w-[21rem] gap-1">
            <span class="font-semibold text-stone-600 dark:text-stone-400">
              Version
            </span>
            <span class="break-anywhere">{version()}</span>
          </div>
        </Show>
        <p class="w-full font-semibold text-stone-600 dark:text-stone-400">
          Repositories
        </p>
        <For each={repos()}>
          {(repo) => (
            <A
              href={`/at/${repo.did}`}
              classList={{
                "w-full flex font-mono relative": true,
                "text-lightblue-500": repo.active,
                "text-gray-300 absolute -left-5 dark:text-gray-600":
                  !repo.active,
              }}
            >
              <Show when={!repo.active}>
                <Tooltip text={repo.status ?? "???"}>
                  <span>🪦</span>
                </Tooltip>
              </Show>
              <span class="w-full hover:underline">{repo.did}</span>
            </A>
          )}
        </For>
        <div class="flex w-full justify-center">
          <Show when={cursor() && !response.loading}>
            <button
              type="button"
              onclick={() => refetch()}
              class="dark:bg-dark-700 dark:hover:bg-dark-800 mt-1 rounded-lg border border-gray-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
            >
              Load More
            </button>
          </Show>
          <Show when={response.loading}>
            <div class="i-line-md-loading-twotone-loop mt-2 text-xl"></div>
          </Show>
        </div>
      </div>
    </Show>
  );
};

export { PdsView };
