import { ComAtprotoServerDescribeServer, ComAtprotoSyncListRepos } from "@atcute/atproto";
import { Client, simpleFetchHandler } from "@atcute/client";
import { InferXRPCBodyOutput } from "@atcute/lexicons";
import * as TID from "@atcute/tid";
import { A, useLocation, useParams } from "@solidjs/router";
import { createWindowVirtualizer } from "@tanstack/solid-virtual";
import { createResource, createSignal, For, Show } from "solid-js";
import { Button } from "../components/button";
import DidHoverCard from "../components/hover-card/did";
import { setPDS } from "../components/navbar";
import { canHover } from "../layout";
import { localDateFromTimestamp } from "../utils/date";

const LIMIT = 1000;

const RepoCard = (props: {
  repo: ComAtprotoSyncListRepos.Repo;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const expanded = () => props.expanded;

  return (
    <div
      classList={{
        "group rounded-md border-[0.5px]": true,
        "dark:hover:bg-dark-200 border-transparent hover:bg-neutral-200/50": !expanded(),
        "dark:bg-dark-300 border-neutral-200 bg-neutral-50 shadow-sm transition-[background-color,border-color,box-shadow] duration-200 dark:border-neutral-700 dark:shadow-dark-700":
          expanded(),
      }}
    >
      <div class="flex min-w-0 flex-1 items-center">
        <button
          type="button"
          onclick={() => props.onToggle()}
          class="flex min-w-0 flex-1 items-center gap-2 p-1.5"
        >
          <span
            classList={{
              "mt-0.5 flex shrink-0 items-center text-neutral-400 transition-transform duration-200 dark:text-neutral-500": true,
              "rotate-90": expanded(),
            }}
          >
            <span class="iconify lucide--chevron-right"></span>
          </span>
          <div class="flex min-w-0 flex-1 items-center gap-x-2 text-sm">
            <span class="min-w-0 truncate font-mono" onclick={(e) => e.stopPropagation()}>
              <DidHoverCard newTab did={props.repo.did} />
            </span>
            <Show when={!props.repo.active}>
              <span class="flex shrink-0 items-center gap-1 text-red-500 dark:text-red-400">
                <span
                  class={`iconify ${
                    props.repo.status === "deactivated" ? "lucide--user-round-x"
                    : props.repo.status === "takendown" ? "lucide--shield-ban"
                    : "lucide--unplug"
                  }`}
                ></span>
                {props.repo.status ?? "inactive"}
              </span>
            </Show>
          </div>
        </button>
        <Show when={expanded() || canHover}>
          <A
            href={`/at://${props.repo.did}`}
            classList={{
              "flex shrink-0 items-center p-2 transition-colors duration-200": true,
              "invisible group-hover:visible not-hover:text-neutral-500 not-hover:dark:text-neutral-400":
                !expanded(),
            }}
          >
            <span class="iconify lucide--arrow-right"></span>
          </A>
        </Show>
      </div>
      <div
        classList={{
          "grid transition-[grid-template-rows] duration-200 ease-out": true,
          "grid-rows-[1fr]": expanded(),
          "grid-rows-[0fr]": !expanded(),
        }}
      >
        <div class="overflow-hidden">
          <div class="ml-7.5 flex flex-col gap-1.5 pb-1.5 font-mono text-xs text-neutral-500 dark:text-neutral-400">
            <Show when={props.repo.head}>
              <span class="truncate">{props.repo.head}</span>
            </Show>
            <Show when={TID.validate(props.repo.rev)}>
              <div class="flex gap-1 text-neutral-700 dark:text-neutral-300">
                <span>{props.repo.rev}</span>
                <span>•</span>
                <span>{localDateFromTimestamp(TID.parse(props.repo.rev).timestamp / 1000)}</span>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  getVersion();
  describeServer();

  const fetchRepos = async () => {
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

  const [expandedIndex, setExpandedIndex] = createSignal<number | null>(null);

  let containerRef: HTMLDivElement | undefined;
  const collapsedHeights = new Map<number, number>();
  const virtualizer = createWindowVirtualizer({
    get count() {
      return repos()?.length ?? 0;
    },
    estimateSize: () => 33,
    overscan: 10,
    get scrollMargin() {
      return containerRef?.offsetTop ?? 0;
    },
  });

  const baseMeasure = virtualizer.measureElement.bind(virtualizer);
  virtualizer.measureElement = (el: Element | null) => {
    if (!el) return;
    const indexStr = el.getAttribute("data-index");
    if (indexStr == null) return;
    const index = parseInt(indexStr, 10);
    if (expandedIndex() === index) return;
    collapsedHeights.set(index, (el as HTMLElement).offsetHeight);
    baseMeasure(el);
  };

  virtualizer.indexFromElement = (node: Element) => {
    const indexStr = node.getAttribute("data-index");
    if (!indexStr) return -1;
    return parseInt(indexStr, 10);
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

  document.title = `${params.pds} - PDSls`;

  return (
    <>
      <Show when={repos() || response()}>
        <div class="flex w-full flex-col px-2">
          <div class="mb-3 flex gap-4 text-sm sm:text-base">
            <Tab tab="repos" label="Repositories" />
            <Tab tab="info" label="Info" />
            <Tab tab="firehose" label="Firehose" />
          </div>
          <Show when={!location.hash || location.hash === "#repos"}>
            <div
              class="-mx-2 mb-9"
              ref={containerRef}
              style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
            >
              <For each={virtualizer.getVirtualItems()}>
                {(virtualItem) => {
                  const isExpanded = () => expandedIndex() === virtualItem.index;
                  return (
                    <div
                      data-index={virtualItem.index}
                      ref={virtualizer.measureElement}
                      classList={{
                        "z-10": isExpanded(),
                        "z-0": !isExpanded(),
                      }}
                      style={{
                        position: "absolute",
                        top: `${virtualItem.start - virtualizer.options.scrollMargin}px`,
                        left: 0,
                        width: "100%",
                        overflow: "visible",
                      }}
                    >
                      <RepoCard
                        repo={repos()![virtualItem.index]}
                        expanded={isExpanded()}
                        onToggle={() => {
                          setExpandedIndex(isExpanded() ? null : virtualItem.index);
                        }}
                      />
                    </div>
                  );
                }}
              </For>
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
          <div class="dark:bg-dark-500 fixed bottom-0 z-5 flex w-screen justify-center border-t border-neutral-200 bg-neutral-100 pt-3 pb-6 dark:border-neutral-700">
            <div class="flex items-center gap-3">
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
                  onClick={() => {
                    setExpandedIndex(null);
                    refetch();
                  }}
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
