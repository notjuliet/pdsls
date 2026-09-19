import { Client, simpleFetchHandler } from "@atcute/client";
import { DidDocument } from "@atcute/identity";
import { ActorIdentifier, Handle, Nsid } from "@atcute/lexicons";
import {
  A,
  type RoutePreloadFunc,
  type RouteSectionProps,
  useLocation,
  useNavigate,
  useParams,
} from "@solidjs/router";
import {
  createEffect,
  createResource,
  createSignal,
  ErrorBoundary,
  For,
  type JSX,
  onMount,
  Show,
  Suspense,
} from "solid-js";

import { Backlinks } from "../../components/backlinks.jsx";
import {
  DomainGroup,
  DomainGroupRows,
  domainGroupRowClasses,
} from "../../components/domain-group.jsx";
import {
  ActionMenu,
  DropdownMenu,
  MenuProvider,
  MenuSeparator,
  NavMenu,
} from "../../components/dropdown.jsx";
import { FilterInput } from "../../components/filter-input.jsx";
import { setPDS } from "../../components/navbar.jsx";
import { NestedLayout } from "../../components/nested-layout.jsx";
import {
  addNotification,
  removeNotification,
  updateNotification,
} from "../../components/notification.jsx";
import { Spinner } from "../../components/spinner.jsx";
import {
  didDocCache,
  getPDS,
  labelerCache,
  resolveHandle,
  resolveLexiconAuthority,
} from "../../lib/api.js";
import { createLatch } from "../../lib/create-latch.js";
import { useFilterShortcut } from "../../lib/keyboard.js";
import { RepoProvider, useRepo } from "../../lib/repo-context.jsx";
import { LabelFeed } from "../labels.jsx";
import { plcDirectory } from "../settings.jsx";
import { BlobView } from "./blob.jsx";
import { IdentityView } from "./identity.jsx";
import { PlcLogView } from "./logs.jsx";

const LazyTab = (props: { children: JSX.Element }) => (
  <ErrorBoundary fallback={(err) => <div class="wrap-break-word">Error: {err.message}</div>}>
    <Suspense
      fallback={<div class="iconify lucide--loader-circle mt-2 animate-spin self-center text-xl" />}
    >
      {props.children}
    </Suspense>
  </ErrorBoundary>
);

type RepoTabId = "collections" | "labels" | "backlinks" | "identity" | "blobs" | "logs";

export const repoPreload: RoutePreloadFunc = ({ params }) => {
  if (params.repo?.startsWith("did:")) void getPDS(params.repo);
};

export const RepoLayout = (props: RouteSectionProps) => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const hasChild = () => !!params.collection || !!params.cid;

  // Redirect non-DID identifiers (handles, NSIDs) via effect — must be separate from
  // the resource because navigate inside a resource fetcher doesn't reliably re-trigger it
  createEffect(() => {
    const identifier = params.repo;
    if (!identifier || identifier.startsWith("did:")) return;
    const hash = location.hash;
    resolveHandle(identifier as Handle)
      .then((resolvedDid) => {
        navigate(`${location.pathname.replace(identifier, resolvedDid)}${hash}`, { replace: true });
      })
      .catch(() => {
        resolveLexiconAuthority(identifier as Nsid)
          .then((authority) => {
            navigate(`/at://${authority}/com.atproto.lexicon.schema/${identifier}${hash}`, {
              replace: true,
            });
          })
          .catch(() => {
            navigate(`/${identifier}`, { replace: true });
          });
      });
  });

  // Resource only runs for DIDs — resolves PDS + creates RPC client
  const [resolution] = createResource(
    () => {
      const id = params.repo;
      return id?.startsWith("did:") ? id : undefined;
    },
    async (did) => {
      setPDS(undefined);
      try {
        const pdsUrl = await getPDS(did);
        const rpc = new Client({ handler: simpleFetchHandler({ service: pdsUrl }) });
        const didDoc = didDocCache[did] as DidDocument | undefined;
        setPDS(pdsUrl.replace("https://", "").replace("http://", ""));
        return { did, pds: pdsUrl, rpc, didDoc };
      } catch {
        let didDoc: DidDocument | undefined;
        if (did.startsWith("did:web")) {
          try {
            const res = await fetch(`https://${did.replace("did:web:", "")}/.well-known/did.json`);
            didDoc = await res.json();
          } catch {}
        }
        setPDS("Missing PDS");
        return {
          did,
          pds: undefined as string | undefined,
          rpc: undefined as Client | undefined,
          didDoc,
          error: "Missing PDS",
        };
      }
    },
  );

  // Only expose data when resolution matches current params (prevents stale data during transitions)
  const current = () => {
    const r = resolution();
    if (!r || r.did !== params.repo) return null;
    return r;
  };

  return (
    <RepoProvider
      value={{
        did: () => params.repo!,
        pds: () => current()?.pds,
        rpc: () => current()?.rpc,
        didDoc: () => current()?.didDoc,
        error: () => current()?.error,
      }}
    >
      <NestedLayout key={params.repo} hasChild={hasChild()} view={() => <RepoView />}>
        {props.children}
      </NestedLayout>
    </RepoProvider>
  );
};

const downloadRepo = async (pdsUrl: string, did: string) => {
  let notificationId: string | null = null;
  const abortController = new AbortController();

  try {
    notificationId = addNotification({
      message: "Downloading repository...",
      progress: 0,
      total: 0,
      type: "info",
      onCancel: () => {
        abortController.abort();
        if (notificationId) removeNotification(notificationId);
      },
    });

    const response = await fetch(`${pdsUrl}/xrpc/com.atproto.sync.getRepo?did=${did}`, {
      signal: abortController.signal,
    });
    if (!response.ok) throw new Error(`HTTP error status: ${response.status}`);

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body?.getReader();
    const chunks: BlobPart[] = [];

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        loaded += value.length;

        if (total > 0) {
          updateNotification(notificationId, {
            progress: Math.round((loaded / total) * 100),
            total,
          });
        } else {
          updateNotification(notificationId, {
            progress: Math.round((loaded / (1024 * 1024)) * 10) / 10,
            total: 0,
          });
        }
      }
    }

    const blob = new Blob(chunks);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${did}-${new Date().toISOString()}.car`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    updateNotification(notificationId, {
      message: "Repository downloaded successfully",
      type: "success",
      progress: undefined,
      onCancel: undefined,
    });
    setTimeout(() => {
      if (notificationId) removeNotification(notificationId);
    }, 3000);
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) {
      console.error("Download failed:", error);
      if (notificationId) {
        updateNotification(notificationId, {
          message: "Download failed",
          type: "error",
          progress: undefined,
          onCancel: undefined,
        });
        setTimeout(() => {
          if (notificationId) removeNotification(notificationId);
        }, 5000);
      }
    }
  }
};

const displayNsidDomain = (authority: string) => authority.split(".").reverse().join(".");

const RepoView = () => {
  const repo = useRepo();
  const params = useParams();
  const hidden = () => !!params.collection || !!params.cid;
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = createSignal<string>();
  const [downloading, setDownloading] = createSignal(false);
  const [nsids, setNsids] = createSignal<Record<string, { hidden: boolean; nsids: string[] }>>();
  const [filter, setFilter] = createSignal<string>();
  const [rotationKeys, setRotationKeys] = createSignal<Array<string>>([]);
  let filterInputRef: HTMLInputElement | undefined;
  const did = repo.did();

  onMount(() => {
    useFilterShortcut(() => filterInputRef);
  });

  const activeTab = (): RepoTabId => {
    if (!location.hash) return error() ? "identity" : "collections";

    const tab = location.hash.slice(1).split(":")[0] as RepoTabId;
    return ["collections", "labels", "identity", "logs", "blobs", "backlinks"].includes(tab)
      ? tab
      : "collections";
  };

  const repoTabs = () =>
    (
      [
        { tab: "collections", label: "Collections", show: !error() },
        { tab: "labels", label: "Labels", show: !!params.repo && params.repo in labelerCache },
        { tab: "identity", label: "Identity", show: true },
        { tab: "logs", label: "Logs", show: did.startsWith("did:plc") },
        { tab: "blobs", label: "Blobs", show: !error() },
        { tab: "backlinks", label: "Backlinks", show: true },
      ] satisfies { tab: RepoTabId; label: string; show: boolean }[]
    ).filter((tab) => tab.show);

  const RepoTab = (props: { tab: RepoTabId; label: string }) => {
    return (
      <A
        classList={{
          "border-b-2 font-medium transition-colors": true,
          "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
            activeTab() !== props.tab,
        }}
        href={`/at://${params.repo}#${props.tab}`}
      >
        {props.label}
      </A>
    );
  };

  const getRotationKeys = async () => {
    const res = await fetch(`${plcDirectory()}/${did}/log/last`);
    const json = await res.json();
    setRotationKeys(json.rotationKeys ?? []);
  };

  const fetchRepo = async () => {
    if (repo.error()) {
      setError(repo.error()!);
    }

    if (did.startsWith("did:plc")) getRotationKeys();

    const rpc = repo.rpc();
    if (!rpc) return {};

    try {
      const res = await rpc.get("com.atproto.repo.describeRepo", {
        params: { repo: did as ActorIdentifier },
      });
      if (res.ok) {
        const collections: Record<string, { hidden: boolean; nsids: string[] }> = {};
        res.data.collections.forEach((c) => {
          const nsid = c.split(".");
          if (nsid.length > 2) {
            const authority = `${nsid[0]}.${nsid[1]}`;
            collections[authority] = {
              nsids: (collections[authority]?.nsids ?? []).concat(nsid.slice(2).join(".")),
              hidden: false,
            };
          }
        });
        setNsids(collections);
      } else {
        console.error(res.data.error);
        switch (res.data.error) {
          case "RepoDeactivated":
            setError("Deactivated");
            break;
          case "RepoTakendown":
            setError("Taken down");
            break;
          default:
            setError("Unreachable");
        }
      }

      return res.data;
    } catch {
      return {};
    }
  };

  const shouldFetch = createLatch(() => !hidden() && (!!repo.rpc() || !!repo.error()));

  const [repoData] = createResource(shouldFetch, fetchRepo);

  const toggleCollapsed = (authority: string) => {
    setNsids((prev) => ({
      ...prev!,
      [authority]: { ...prev![authority], hidden: !prev![authority].hidden },
    }));
  };

  const collapseAll = () => {
    setNsids((prev) =>
      Object.fromEntries(Object.entries(prev!).map(([k, v]) => [k, { ...v, hidden: true }])),
    );
  };

  const expandAll = () => {
    setNsids((prev) =>
      Object.fromEntries(Object.entries(prev!).map(([k, v]) => [k, { ...v, hidden: false }])),
    );
  };

  const handleDownload = async () => {
    const pdsUrl = repo.pds();
    if (!pdsUrl) return;
    setDownloading(true);
    await downloadRepo(pdsUrl, did);
    setDownloading(false);
  };

  createEffect(() => {
    if (hidden()) return;
    const handle = repo
      .didDoc()
      ?.alsoKnownAs?.find((alias) => alias.startsWith("at://"))
      ?.replace("at://", "");
    document.title = handle ? `${handle} - PDSls` : `${params.repo} - PDSls`;
  });

  return (
    <Show when={!hidden()}>
      <Show when={repoData.state === "unresolved" || repoData.loading}>
        <Spinner />
      </Show>
      <Show when={repoData.state === "ready" || repo.error()}>
        <div class="flex w-full flex-col gap-3 wrap-break-word">
          <div class="flex items-center justify-between gap-2 px-2 text-sm sm:text-base">
            <div class="relative min-w-0 flex-1 sm:hidden">
              <select
                aria-label="Repository section"
                value={activeTab()}
                class="dark:bg-dark-100 w-full appearance-none rounded-md border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 pr-8 text-sm outline-none focus:border-neutral-400 dark:border-neutral-600 dark:scheme-dark dark:focus:border-neutral-500"
                onChange={(event) => navigate(`/at://${params.repo}#${event.currentTarget.value}`)}
              >
                <For each={repoTabs()}>{(tab) => <option value={tab.tab}>{tab.label}</option>}</For>
              </select>
              <span class="iconify lucide--chevron-down pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" />
            </div>

            <div class="hidden items-center gap-4 sm:flex">
              <For each={repoTabs()}>{(tab) => <RepoTab tab={tab.tab} label={tab.label} />}</For>
            </div>
            <div class="flex gap-1">
              <Show when={error() && error() !== "Missing PDS"}>
                <div class="flex items-center gap-1 rounded-md border border-red-500 px-1.5 py-0.5 text-xs font-medium text-red-500 sm:text-sm dark:border-red-400 dark:text-red-400">
                  <span
                    class={`iconify ${
                      error() === "Deactivated"
                        ? "lucide--user-round-x"
                        : error() === "Taken down"
                          ? "lucide--shield-ban"
                          : "lucide--unplug"
                    }`}
                  ></span>
                  <span>{error()}</span>
                </div>
              </Show>
              <MenuProvider>
                <DropdownMenu icon="lucide--ellipsis" buttonClass="rounded-sm p-1.5">
                  <NavMenu
                    href={`/streams?type=jetstream&dids=${encodeURIComponent(params.repo!)}`}
                    label="Jetstream"
                    icon="lucide--radio-tower"
                  />
                  <Show when={error()?.length === 0 || error() === undefined}>
                    <ActionMenu
                      label="Download repo"
                      icon={
                        downloading() ? "lucide--loader-circle animate-spin" : "lucide--download"
                      }
                      onClick={handleDownload}
                    />
                  </Show>
                  <MenuSeparator />
                  <NavMenu
                    href={
                      did.startsWith("did:plc")
                        ? `${plcDirectory()}/${did}`
                        : `https://${did.split("did:web:")[1]}/.well-known/did.json`
                    }
                    newTab
                    label="DID document"
                    icon="lucide--external-link"
                  />
                </DropdownMenu>
              </MenuProvider>
            </div>
          </div>
          <div class="flex w-full flex-col gap-1 px-2">
            <Show when={location.hash.startsWith("#logs")}>
              <LazyTab>
                <PlcLogView did={did} />
              </LazyTab>
            </Show>
            <Show when={location.hash === "#backlinks" || location.hash.startsWith("#backlinks:")}>
              <LazyTab>
                <Backlinks target={did} />
              </LazyTab>
            </Show>
            <Show when={location.hash === "#blobs"}>
              <LazyTab>
                <BlobView pds={repo.pds()!} repo={did} />
              </LazyTab>
            </Show>
            <Show when={location.hash === "#labels" && labelerCache[did]}>
              <LazyTab>
                <LabelFeed labelerDid={did} labelerEndpoint={labelerCache[did]} />
              </LazyTab>
            </Show>
            <Show when={nsids() && (!location.hash || location.hash.startsWith("#collections"))}>
              <div class="flex flex-col gap-1 pb-22 text-sm wrap-anywhere sm:gap-0">
                <Show
                  when={Object.keys(nsids() ?? {}).length != 0}
                  fallback={<span class="mt-3 text-center text-base">No collections found.</span>}
                >
                  <For
                    each={Object.keys(nsids() ?? {})
                      .filter((authority) =>
                        filter()
                          ? authority.includes(filter()!) ||
                            displayNsidDomain(authority).includes(filter()!) ||
                            nsids()?.[authority].nsids.some((nsid) =>
                              `${authority}.${nsid}`.includes(filter()!),
                            )
                          : true,
                      )
                      .sort((a, b) => displayNsidDomain(a).localeCompare(displayNsidDomain(b)))}
                  >
                    {(authority) => {
                      const isCollapsed = () => nsids()?.[authority].hidden ?? false;
                      const domain = displayNsidDomain(authority);
                      const collectionCount = () => nsids()?.[authority].nsids.length ?? 0;

                      return (
                        <DomainGroup
                          domain={domain}
                          domainTitle={`${domain} (${authority})`}
                          groupLabel="collections"
                          sticky
                          collapsed={isCollapsed()}
                          collapsedLabel={
                            <>
                              {collectionCount()}{" "}
                              {collectionCount() === 1 ? "collection" : "collections"}
                            </>
                          }
                          onToggle={() => toggleCollapsed(authority)}
                        >
                          <DomainGroupRows>
                            <For
                              each={nsids()?.[authority].nsids.filter((nsid) =>
                                filter() ? `${authority}.${nsid}`.includes(filter()!) : true,
                              )}
                            >
                              {(nsid) => (
                                <A
                                  href={`/at://${did}/${authority}.${nsid}`}
                                  class={`truncate hover:underline active:underline ${domainGroupRowClasses}`}
                                  title={`${authority}.${nsid}`}
                                >
                                  <span class="text-neutral-500 dark:text-neutral-400">
                                    {authority}.
                                  </span>
                                  {nsid}
                                </A>
                              )}
                            </For>
                          </DomainGroupRows>
                        </DomainGroup>
                      );
                    }}
                  </For>
                </Show>
              </div>
            </Show>
            <Show when={location.hash === "#identity" || (error() && !location.hash)}>
              <Show when={repo.didDoc()}>
                {(didDoc) => <IdentityView didDoc={didDoc()} rotationKeys={rotationKeys()} />}
              </Show>
            </Show>
          </div>
        </div>

        <Show when={nsids() && (!location.hash || location.hash.startsWith("#collections"))}>
          <div class="bottom-controls-fade dark:bg-dark-500 fixed bottom-0 z-10 flex w-full flex-col items-center gap-2 bg-neutral-100 px-3 pt-3 pb-6">
            <FilterInput
              class="w-full max-w-[34.5rem]"
              inputRef={(input) => (filterInputRef = input)}
              name="filter"
              placeholder="Filter collections..."
              value={filter() ?? ""}
              onInput={(value) => setFilter(value.toLowerCase())}
            />
            <div class="flex w-full max-w-[34.5rem] justify-end gap-1">
              <button
                class="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 active:bg-neutral-300 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 dark:active:bg-neutral-600"
                onClick={expandAll}
              >
                Expand all
              </button>
              <button
                class="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 active:bg-neutral-300 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 dark:active:bg-neutral-600"
                onClick={collapseAll}
              >
                Collapse all
              </button>
            </div>
          </div>
        </Show>
      </Show>
    </Show>
  );
};
