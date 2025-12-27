import { ComAtprotoServerDescribeServer, ComAtprotoSyncListRepos } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { InferXRPCBodyOutput } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import { A, useLocation, useParams } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { Button } from "../components/button";
import { CopyMenu, DropdownMenu, MenuProvider, NavMenu } from "../components/dropdown";
import { Modal } from "../components/modal";
import { setPDS } from "../components/navbar";
import Tooltip from "../components/tooltip";
import { resolveDidDoc } from "../utils/api";
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
    const [handle, setHandle] = createSignal<string>();

    const fetchHandle = async () => {
      try {
        const doc = await resolveDidDoc(repo.did);
        const aka = doc.alsoKnownAs?.find((a) => a.startsWith("at://"));
        if (aka) setHandle(aka.replace("at://", ""));
      } catch {}
    };

    return (
      <div class="flex items-center gap-0.5">
        <A
          href={`/at://${repo.did}`}
          class="grow truncate rounded-md p-0.5 font-mono hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          {repo.did}
        </A>
        <Show when={!repo.active}>
          <Tooltip text={repo.status ?? "Unknown status"}>
            <span class="iconify lucide--unplug text-red-500 dark:text-red-400"></span>
          </Tooltip>
        </Show>
        <button
          onclick={() => {
            setOpenInfo(true);
            if (!handle()) fetchHandle();
          }}
          class="flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
        >
          <span class="iconify lucide--info text-neutral-600 dark:text-neutral-400"></span>
        </button>
        <Modal open={openInfo()} onClose={() => setOpenInfo(false)}>
          <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute top-70 left-[50%] w-max max-w-[90vw] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-white p-3 shadow-md transition-opacity duration-200 sm:max-w-xl dark:border-neutral-700 starting:opacity-0">
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
              <span class="font-medium">Handle:</span>
              <span class="text-neutral-700 dark:text-neutral-300">{handle()}</span>
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

  const Tab = (props: { tab: "repos" | "info"; label: string }) => (
    <A
      classList={{
        "border-b-2": true,
        "border-transparent hover:border-neutral-400 dark:hover:border-neutral-600":
          (!!location.hash && location.hash !== `#${props.tab}`) ||
          (!location.hash && props.tab !== "repos"),
      }}
      href={`/${params.pds}#${props.tab}`}
    >
      {props.label}
    </A>
  );

  return (
    <Show when={repos() || response()}>
      <div class="flex w-full flex-col">
        <div class="dark:shadow-dark-700 dark:bg-dark-300 mb-2 flex w-full justify-between rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-sm shadow-xs dark:border-neutral-700">
          <div class="ml-1 flex items-center gap-3">
            <Tab tab="repos" label="Repositories" />
            <Tab tab="info" label="Info" />
          </div>
          <MenuProvider>
            <DropdownMenu icon="lucide--ellipsis-vertical" buttonClass="rounded-sm p-1.5">
              <CopyMenu content={params.pds!} label="Copy PDS" icon="lucide--copy" />
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
        <div class="dark:bg-dark-500 fixed bottom-0 z-5 flex w-screen justify-center bg-neutral-100 pt-2 pb-4">
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
