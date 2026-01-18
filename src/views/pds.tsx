import { ComAtprotoServerDescribeServer, ComAtprotoSyncListRepos } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { InferXRPCBodyOutput } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import { Title } from "@solidjs/meta";
import { A, useLocation, useParams } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { Button } from "../components/button";
import DidHoverCard from "../components/hover-card/did";
import { Modal } from "../components/modal";
import { setPDS } from "../components/navbar";
import Tooltip from "../components/tooltip";
import { localDateFromTimestamp } from "../utils/date";

const LIMIT = 1000;

const PdsView = () => {
  const params = useParams();
  const location = useLocation();
  const [version, setVersion] = createSignal<string>();
  const [serverInfos, setServerInfos] =
    createSignal<InferXRPCBodyOutput<ComAtprotoServerDescribeServer.mainSchema["output"]>>();
  const [cursor, setCursor] = createSignal<string>();
  setPDS(params.pds);
  const pds =
    params.pds!.startsWith("localhost") ? `http://${params.pds}` : `https://${params.pds}`;
  const rpc = new Client({ handler: simpleFetchHandler({ service: pds }) });

  const getVersion = async () => {
    // @ts-expect-error: undocumented endpoint
    const res = await rpc.get("_health", {});
    setVersion((res.data as any).version);
  };

  const describeServer = async () => {
    const res = await rpc.get("com.atproto.server.describeServer");
    if (!res.ok) console.error(res.data.error);
    else setServerInfos(res.data);
  };

  const fetchRepos = async () => {
    getVersion();
    describeServer();
    const res = await rpc.get("com.atproto.sync.listRepos", {
      params: { limit: LIMIT, cursor: cursor() },
    });
    if (!res.ok) throw new Error(res.data.error);
    setCursor(res.data.repos.length < LIMIT ? undefined : res.data.cursor);
    setRepos(repos()?.concat(res.data.repos) ?? res.data.repos);
    return res.data;
  };

  const [response, { refetch }] = createResource(fetchRepos);
  const [repos, setRepos] = createSignal<ComAtprotoSyncListRepos.Repo[]>();

  const RepoCard = (repo: ComAtprotoSyncListRepos.Repo) => {
    const [openInfo, setOpenInfo] = createSignal(false);

    return (
      <div class="flex items-center gap-0.5">
        <DidHoverCard
          did={repo.did}
          class="min-w-0 grow"
          trigger={
            <A
              href={`/at://${repo.did}`}
              class="block truncate rounded-md p-0.5 font-mono hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
            >
              {repo.did}
            </A>
          }
        />
        <Show when={!repo.active}>
          <Tooltip text={repo.status ?? "Unknown status"}>
            <span class="iconify lucide--unplug text-red-500 dark:text-red-400"></span>
          </Tooltip>
        </Show>
        <button
          onclick={() => setOpenInfo(true)}
          class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          <span class="iconify lucide--info text-neutral-600 dark:text-neutral-400"></span>
        </button>
        <Modal open={openInfo()} onClose={() => setOpenInfo(false)}>
          <div class="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto w-max max-w-[90vw] rounded-lg border-[0.5px] border-neutral-300 bg-white p-3 shadow-md transition-opacity duration-200 sm:max-w-xl dark:border-neutral-700 starting:opacity-0">
            <div class="mb-2 flex items-center justify-between gap-4">
              <p class="truncate font-semibold">{repo.did}</p>
              <button
                onclick={() => setOpenInfo(false)}
                class="flex shrink-0 items-center rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 active:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 dark:active:bg-neutral-600"
              >
                <span class="iconify lucide--x"></span>
              </button>
            </div>
            <div class="grid grid-cols-[auto_1fr] items-baseline gap-x-1 gap-y-0.5 text-sm">
              <span class="font-medium">Head:</span>
              <span class="wrap-anywhere text-neutral-700 dark:text-neutral-300">{repo.head}</span>

              <Show when={TID.validate(repo.rev)}>
                <span class="font-medium">Rev:</span>
                <div class="flex gap-1">
                  <span class="text-neutral-700 dark:text-neutral-300">{repo.rev}</span>
                  <span class="text-neutral-600 dark:text-neutral-400">·</span>
                  <span class="text-neutral-600 dark:text-neutral-400">
                    {localDateFromTimestamp(TID.parse(repo.rev).timestamp / 1000)}
                  </span>
                </div>
              </Show>

              <Show when={repo.active !== undefined}>
                <span class="font-medium">Active:</span>
                <span
                  class={`iconify self-center ${
                    repo.active ?
                      "lucide--check text-green-500 dark:text-green-400"
                    : "lucide--x text-red-500 dark:text-red-400"
                  }`}
                ></span>
              </Show>

              <Show when={repo.status}>
                <span class="font-medium">Status:</span>
                <span class="text-neutral-700 dark:text-neutral-300">{repo.status}</span>
              </Show>
            </div>
          </div>
        </Modal>
      </div>
    );
  };

  const Tab = (props: { tab: "repos" | "info" | "firehose"; label: string }) => (
    <A
      classList={{
        "border-b-2 font-medium": true,
        "border-transparent dark:text-neutral-300/80 text-neutral-600 hover:border-neutral-600 dark:hover:border-neutral-300/80":
          (!!location.hash && location.hash !== `#${props.tab}`) ||
          (!location.hash && props.tab !== "repos"),
      }}
      href={
        props.tab === "firehose" ?
          `/firehose?instance=wss://${params.pds}`
        : `/${params.pds}#${props.tab}`
      }
    >
      {props.label}
    </A>
  );

  return (
    <>
      <Title>{params.pds} - PDSls</Title>
      <Show when={repos() || response()}>
        <div class="flex w-full flex-col px-2">
          <div class="mb-3 flex gap-4 text-sm sm:text-base">
            <Tab tab="repos" label="Repositories" />
            <Tab tab="info" label="Info" />
            <Tab tab="firehose" label="Firehose" />
          </div>
          <Show when={!location.hash || location.hash === "#repos"}>
            <div class="flex flex-col divide-y-[0.5px] divide-neutral-300 pb-20 dark:divide-neutral-700">
              <For each={repos()}>{(repo) => <RepoCard {...repo} />}</For>
            </div>
          </Show>
          <div class="flex flex-col gap-2">
            <Show when={location.hash === "#info"}>
              <Show when={version()}>
                {(version) => (
                  <div class="flex flex-col">
                    <span class="font-semibold">Version</span>
                    <span class="text-sm text-neutral-700 dark:text-neutral-300">{version()}</span>
                  </div>
                )}
              </Show>
              <Show when={serverInfos()}>
                {(server) => (
                  <>
                    <div class="flex flex-col">
                      <span class="font-semibold">DID</span>
                      <span class="text-sm">{server().did}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span class="font-semibold">Invite Code Required</span>
                      <span
                        classList={{
                          "iconify lucide--check text-green-500 dark:text-green-400":
                            server().inviteCodeRequired === true,
                          "iconify lucide--x text-red-500 dark:text-red-400":
                            !server().inviteCodeRequired,
                        }}
                      ></span>
                    </div>
                    <Show when={server().phoneVerificationRequired}>
                      <div class="flex items-center gap-1">
                        <span class="font-semibold">Phone Verification Required</span>
                        <span class="iconify lucide--check text-green-500 dark:text-green-400"></span>
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
                    <Show when={server().links?.privacyPolicy}>
                      <div class="flex flex-col">
                        <span class="font-semibold">Privacy Policy</span>
                        <a
                          href={server().links?.privacyPolicy}
                          class="text-sm hover:underline"
                          target="_blank"
                          rel="noopener"
                        >
                          {server().links?.privacyPolicy}
                        </a>
                      </div>
                    </Show>
                    <Show when={server().links?.termsOfService}>
                      <div class="flex flex-col">
                        <span class="font-semibold">Terms of Service</span>
                        <a
                          href={server().links?.termsOfService}
                          class="text-sm hover:underline"
                          target="_blank"
                          rel="noopener"
                        >
                          {server().links?.termsOfService}
                        </a>
                      </div>
                    </Show>
                    <Show when={server().contact?.email}>
                      <div class="flex flex-col">
                        <span class="font-semibold">Contact</span>
                        <a
                          href={`mailto:${server().contact?.email}`}
                          class="text-sm hover:underline"
                        >
                          {server().contact?.email}
                        </a>
                      </div>
                    </Show>
                  </>
                )}
              </Show>
            </Show>
          </div>
        </div>
        <Show when={!location.hash || location.hash === "#repos"}>
          <div class="dark:bg-dark-500 fixed bottom-0 z-5 flex w-screen justify-center bg-neutral-100 pt-2 pb-4">
            <div class="flex flex-col items-center gap-1 pb-2">
              <p>{repos()?.length} loaded</p>
              <Show when={!response.loading && cursor()}>
                <Button onClick={() => refetch()}>Load more</Button>
              </Show>
              <Show when={response.loading}>
                <span class="iconify lucide--loader-circle animate-spin py-3.5 text-xl"></span>
              </Show>
            </div>
          </div>
        </Show>
      </Show>
    </>
  );
};

export { PdsView };
