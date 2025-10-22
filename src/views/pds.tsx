import { ComAtprotoServerDescribeServer, ComAtprotoSyncListRepos } from "@atcute/atproto";
import { Client, CredentialManager } from "@atcute/client";
import { InferXRPCBodyOutput } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import { A, useLocation, useParams } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { Button } from "../components/button";
import { CopyMenu, DropdownMenu, MenuProvider, NavMenu } from "../components/dropdown";
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
  const pds = params.pds.startsWith("localhost") ? `http://${params.pds}` : `https://${params.pds}`;
  const rpc = new Client({ handler: new CredentialManager({ service: pds }) });

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
      <div class="flex items-center">
        <A
          href={`/at://${repo.did}`}
          class="grow truncate rounded py-0.5 font-mono hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          {repo.did}
        </A>
        <Show when={!repo.active}>
          <Tooltip text={repo.status ?? "Unknown status"}>
            <span class="iconify lucide--unplug text-red-500 dark:text-red-400"></span>
          </Tooltip>
        </Show>
        <button
          onclick={() => setOpenInfo(true)}
          class="flex items-center rounded-lg p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          <span class="iconify lucide--info"></span>
        </button>
        <Modal open={openInfo()} onClose={() => setOpenInfo(false)}>
          <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute top-70 left-[50%] w-max max-w-full -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-3 wrap-break-word shadow-md transition-opacity duration-200 sm:max-w-lg dark:border-neutral-700 starting:opacity-0">
            <div class="mb-1 flex justify-between gap-2">
              <div class="flex items-center gap-1">
                <span class="iconify lucide--info"></span>
                <span class="font-semibold">{repo.did}</span>
              </div>
              <button
                onclick={() => setOpenInfo(false)}
                class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
              >
                <span class="iconify lucide--x"></span>
              </button>
            </div>
            <div class="flex flex-col text-sm">
              <span>
                Head: <span class="text-xs">{repo.head}</span>
              </span>
              <Show when={TID.validate(repo.rev)}>
                <span>
                  Rev: {repo.rev} ({localDateFromTimestamp(TID.parse(repo.rev).timestamp / 1000)})
                </span>
              </Show>
              <Show when={repo.active !== undefined}>
                <span>Active: {repo.active ? "true" : "false"}</span>
              </Show>
              <Show when={repo.status}>
                <span>Status: {repo.status}</span>
              </Show>
            </div>
          </div>
        </Modal>
      </div>
    );
  };

  const Tab = (props: { tab: "repos" | "info"; label: string }) => (
    <div class="flex items-center gap-0.5">
      <A
        classList={{
          "flex items-center gap-1 border-b-2": true,
          "border-transparent hover:border-neutral-400 dark:hover:border-neutral-600":
            (!!location.hash && location.hash !== `#${props.tab}`) ||
            (!location.hash && props.tab !== "repos"),
        }}
        href={`/${params.pds}#${props.tab}`}
      >
        {props.label}
      </A>
    </div>
  );

  return (
    <Show when={repos() || response()}>
      <div class="flex w-full flex-col">
        <div class="dark:shadow-dark-700 dark:bg-dark-300 mb-2 flex w-full justify-between rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 px-2 py-1.5 text-sm shadow-xs dark:border-neutral-700">
          <div class="flex gap-3">
            <Tab tab="repos" label="Repositories" />
            <Tab tab="info" label="Info" />
          </div>
          <MenuProvider>
            <DropdownMenu
              icon="lucide--ellipsis-vertical"
              buttonClass="rounded-sm p-1"
              menuClass="top-8 p-2 text-sm"
            >
              <CopyMenu content={params.pds} label="Copy PDS" icon="lucide--copy" />
              <NavMenu
                href={`/firehose?instance=wss://${params.pds}`}
                label="Firehose"
                icon="lucide--radio-tower"
              />
            </DropdownMenu>
          </MenuProvider>
        </div>
        <div class="flex flex-col gap-1 px-2">
          <Show when={!location.hash || location.hash === "#repos"}>
            <div class="flex flex-col divide-y-[0.5px] divide-neutral-300 dark:divide-neutral-700">
              <For each={repos()}>{(repo) => <RepoCard {...repo} />}</For>
            </div>
          </Show>
          <Show when={location.hash === "#info"}>
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
                  <div class="flex items-baseline gap-x-1">
                    <span class="font-semibold">DID</span>
                    <span class="truncate text-sm">{server().did}</span>
                  </div>
                  <Show when={server().inviteCodeRequired}>
                    <span class="font-semibold">Invite Code Required</span>
                  </Show>
                  <Show when={server().phoneVerificationRequired}>
                    <span class="font-semibold">Phone Verification Required</span>
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
                      <a href={`mailto:${server().contact?.email}`} class="text-sm hover:underline">
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
        <div class="dark:bg-dark-500 fixed bottom-0 z-5 flex w-screen justify-center bg-neutral-100 py-2">
          <div class="flex flex-col items-center gap-1 pb-2">
            <p>{repos()?.length} loaded</p>
            <Show when={!response.loading && cursor()}>
              <Button onClick={() => refetch()}>Load More</Button>
            </Show>
            <Show when={response.loading}>
              <span class="iconify lucide--loader-circle animate-spin py-3.5 text-xl"></span>
            </Show>
          </div>
        </div>
      </Show>
    </Show>
  );
};

export { PdsView };
