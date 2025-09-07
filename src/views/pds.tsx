import { ComAtprotoServerDescribeServer, ComAtprotoSyncListRepos } from "@atcute/atproto";
import { Client, CredentialManager } from "@atcute/client";
import { InferXRPCBodyOutput } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import { A, useParams } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { Button } from "../components/button";
import { setPDS } from "../components/navbar";
import Tooltip from "../components/tooltip";
import { localDateFromTimestamp } from "../utils/date";

const LIMIT = 1000;

const PdsView = () => {
  const params = useParams();
  if (params.pds.startsWith("web%2Bat%3A%2F%2F")) return;
  const [version, setVersion] = createSignal<string>();
  const [serverInfos, setServerInfos] =
    createSignal<InferXRPCBodyOutput<ComAtprotoServerDescribeServer.mainSchema["output"]>>();
  const [cursor, setCursor] = createSignal<string>();
  setPDS(params.pds);
  const pds = params.pds.startsWith("localhost") ? `http://${params.pds}` : `https://${params.pds}`;
  const rpc = new Client({ handler: new CredentialManager({ service: pds }) });

  const getVersion = async () => {
    // @ts-expect-error: undocumented endpoint
    const res = await rpc.get("_health", {});
    setVersion((res.data as any).version);
  };

  const fetchRepos = async () => {
    await getVersion();
    const describeRes = await rpc.get("com.atproto.server.describeServer");
    if (!describeRes.ok) console.error(describeRes.data.error);
    else setServerInfos(describeRes.data);
    const res = await rpc.get("com.atproto.sync.listRepos", {
      params: { limit: LIMIT, cursor: cursor() },
    });
    if (!res.ok) throw new Error(res.data.error);
    setCursor(res.data.repos.length < LIMIT ? undefined : res.data.cursor);
    setRepos(repos()?.concat(res.data.repos) ?? res.data.repos);
    await getVersion();
    return res.data;
  };

  const [response, { refetch }] = createResource(fetchRepos);
  const [repos, setRepos] = createSignal<ComAtprotoSyncListRepos.Repo[]>();

  return (
    <Show when={repos() || response()}>
      <div class="flex w-[22rem] flex-col sm:w-[24rem]">
        <Show when={version()}>
          {(version) => (
            <div class="flex items-baseline gap-x-1">
              <span class="font-semibold">Version</span>
              <span class="truncate text-sm">{version()}</span>
            </div>
          )}
        </Show>
        <Show when={serverInfos()}>
          {(server) => (
            <>
              <Show when={server().inviteCodeRequired}>
                <div class="flex items-baseline gap-x-1">
                  <span class="font-semibold">Invite Code Required</span>
                  <span class="text-sm">{server().inviteCodeRequired ? "Yes" : "No"}</span>
                </div>
              </Show>
              <Show when={server().phoneVerificationRequired}>
                <div class="flex items-baseline gap-x-1">
                  <span class="font-semibold">Phone Verification Required</span>
                  <span class="text-sm">{server().phoneVerificationRequired ? "Yes" : "No"}</span>
                </div>
              </Show>
              <Show when={server().availableUserDomains.length}>
                <div class="flex flex-col">
                  <span class="font-semibold">Available User Domains</span>
                  <For each={server().availableUserDomains}>
                    {(domain) => <span class="text-sm wrap-anywhere">{domain}</span>}
                  </For>
                </div>
              </Show>
            </>
          )}
        </Show>
        <p class="w-full font-semibold">{repos()?.length} Repositories</p>
        <For each={repos()}>
          {(repo) => (
            <A
              href={`/at://${repo.did}`}
              classList={{
                "rounded items-center text-sm gap-1 flex justify-between font-mono relative hover:bg-neutral-200 dark:hover:bg-neutral-700 active:bg-neutral-200 dark:active:bg-neutral-700": true,
                "text-blue-400": repo.active,
                "text-neutral-400 dark:text-neutral-500": !repo.active,
              }}
            >
              <Show when={!repo.active}>
                <div class="absolute -left-4">
                  <Tooltip text={repo.status ?? "???"}>
                    <span class="iconify lucide--skull"></span>
                  </Tooltip>
                </div>
              </Show>
              <span class="text-sm">{repo.did}</span>
              <Show when={TID.validate(repo.rev)}>
                <span class="text-xs text-neutral-500 dark:text-neutral-400">
                  {localDateFromTimestamp(TID.parse(repo.rev).timestamp / 1000).split(" ")[0]}
                </span>
              </Show>
            </A>
          )}
        </For>
        <div class="mt-2 flex w-full justify-center">
          <Show when={cursor() && !response.loading}>
            <Button onClick={() => refetch()}>Load More</Button>
          </Show>
          <Show when={response.loading}>
            <span class="iconify lucide--loader-circle animate-spin text-xl"></span>
          </Show>
        </div>
      </div>
    </Show>
  );
};

export { PdsView };
