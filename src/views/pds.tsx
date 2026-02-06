import { ComAtprotoServerDescribeServer, ComAtprotoSyncListRepos } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { InferXRPCBodyOutput } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import { Title } from "@solidjs/meta";
import { A, useLocation, useParams } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import { Button } from "../components/button";
import DidHoverCard from "../components/hover-card/did";
import { setPDS } from "../components/navbar";
import { canHover } from "../layout";
import { localDateFromTimestamp } from "../utils/date";

const LIMIT = 1000;

export const PdsView = () => {
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
    const [expanded, setExpanded] = createSignal(false);
    const [hovering, setHovering] = createSignal(false);

    return (
      <div class="flex flex-col gap-1">
        <div
          class="dark:hover:bg-dark-200 flex min-w-0 flex-1 items-center rounded hover:bg-neutral-200/70"
          onMouseEnter={() => canHover && setHovering(true)}
          onMouseLeave={() => canHover && setHovering(false)}
        >
          <button
            type="button"
            onclick={() => setExpanded(!expanded())}
            class="flex min-w-0 flex-1 items-center gap-2 p-1.5"
          >
            <span class="mt-0.5 flex shrink-0 items-center text-neutral-400 dark:text-neutral-500">
              {expanded() ?
                <span class="iconify lucide--chevron-down"></span>
              : <span class="iconify lucide--chevron-right"></span>}
            </span>
            <div class="flex min-w-0 flex-1 items-center gap-x-2 text-sm">
              <span class="min-w-0 truncate font-mono" onclick={(e) => e.stopPropagation()}>
                <DidHoverCard newTab did={repo.did} />
              </span>
              <Show when={!repo.active}>
                <span class="flex shrink-0 items-center gap-1 text-red-500 dark:text-red-400">
                  <span
                    class={`iconify ${
                      repo.status === "deactivated" ? "lucide--user-round-x"
                      : repo.status === "takendown" ? "lucide--shield-ban"
                      : "lucide--unplug"
                    }`}
                  ></span>
                  {repo.status ?? "inactive"}
                </span>
              </Show>
            </div>
          </button>
          <Show when={expanded() || hovering()}>
            <A
              href={`/at://${repo.did}`}
              class="flex shrink-0 items-center p-2 transition-colors not-hover:text-neutral-500 not-hover:dark:text-neutral-400"
            >
              <span class="iconify lucide--arrow-right"></span>
            </A>
          </Show>
        </div>
        <Show when={expanded()}>
          <div class="mb-2 ml-7.5 flex flex-col gap-1 font-mono text-xs text-neutral-500 dark:text-neutral-400">
            <Show when={repo.head}>
              <span class="truncate">{repo.head}</span>
            </Show>
            <Show when={TID.validate(repo.rev)}>
              <div class="flex gap-1 text-neutral-700 dark:text-neutral-300">
                <span>{repo.rev}</span>
                <span>•</span>
                <span>{localDateFromTimestamp(TID.parse(repo.rev).timestamp / 1000)}</span>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    );
  };

  const Tab = (props: { tab: "repos" | "info" | "firehose"; label: string }) => (
    <A
      classList={{
        "border-b-2 font-medium transition-colors": true,
        "border-transparent not-hover:dark:text-neutral-300/80 not-hover:text-neutral-600":
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
            <div class="-mx-2 flex flex-col pb-20">
              <For each={repos()}>{(repo) => <RepoCard {...repo} />}</For>
            </div>
          </Show>
          <div class="flex flex-col gap-3">
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
                      <span class="text-sm text-neutral-700 dark:text-neutral-300">
                        {server().did}
                      </span>
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
                        <span class="font-semibold">Captcha Verification Required</span>
                        <span class="iconify lucide--check text-green-500 dark:text-green-400"></span>
                      </div>
                    </Show>
                    <Show when={server().availableUserDomains.length}>
                      <div class="flex flex-col">
                        <span class="font-semibold">Available User Domains</span>
                        <For each={server().availableUserDomains}>
                          {(domain) => (
                            <span class="text-sm wrap-anywhere text-neutral-700 dark:text-neutral-300">
                              {domain}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                    <Show when={server().links?.privacyPolicy}>
                      <div class="flex flex-col">
                        <span class="font-semibold">Privacy Policy</span>
                        <a
                          href={server().links?.privacyPolicy}
                          class="text-sm text-neutral-700 hover:underline dark:text-neutral-300"
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
                          class="text-sm text-neutral-700 hover:underline dark:text-neutral-300"
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
                          class="text-sm text-neutral-700 hover:underline dark:text-neutral-300"
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
            <div class="flex items-center gap-3 pb-2">
              <p>
                {repos()?.length} loaded
                <Show when={repos()?.some((r) => !r.active)}>
                  {" · "}
                  <span class="text-neutral-500 dark:text-neutral-400">
                    {repos()?.filter((r) => !r.active).length} inactive
                  </span>
                </Show>
              </p>
              <Show when={cursor()}>
                <Button
                  onClick={() => refetch()}
                  disabled={response.loading}
                  classList={{ "w-20 h-7.5 justify-center": true }}
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
        </Show>
      </Show>
    </>
  );
};
