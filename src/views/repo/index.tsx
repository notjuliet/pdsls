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
import { createEffect, createResource, createSignal, For, onMount, Show } from "solid-js";

import { Backlinks } from "../../components/backlinks.jsx";
import {
  ActionMenu,
  DropdownMenu,
  MenuProvider,
  MenuSeparator,
  NavMenu,
} from "../../components/dropdown.jsx";
import { Favicon } from "../../components/favicon.jsx";
import { FilterInput } from "../../components/filter-input.jsx";
import { LazyTab } from "../../components/lazy-tab.jsx";
import { setPDS } from "../../components/navbar.jsx";
import { NestedLayout } from "../../components/nested-layout.jsx";
import {
  addNotification,
  removeNotification,
  updateNotification,
} from "../../components/notification.jsx";
import { Spinner } from "../../components/spinner.jsx";
import { canHover } from "../../layout.jsx";
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
import { plcDirectory } from "../settings.jsx";
import { BlobView } from "./blob.jsx";
import { IdentityView } from "./identity.jsx";
import { PlcLogView } from "./logs.jsx";

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
  const [error, setError] = createSignal<string>();
  const [downloading, setDownloading] = createSignal(false);
  const [nsids, setNsids] = createSignal<Record<string, { hidden: boolean; nsids: string[] }>>();
  const [filter, setFilter] = createSignal<string>();
  const [rotationKeys, setRotationKeys] = createSignal<Array<string>>([]);
  let filterInputRef: HTMLInputElement | undefined;
  const did = repo.did();

  // Handle scrolling to a collection group when hash is like #collections:app.bsky
  createEffect(() => {
    const hash = location.hash;
    if (hash.startsWith("#collections:") && nsids()) {
      const authority = hash.slice(13);
      requestAnimationFrame(() => {
        const element = document.getElementById(`collection-${authority}`);
        if (element) element.scrollIntoView({ behavior: "instant", block: "start" });
      });
    }
  });

  onMount(() => {
    useFilterShortcut(() => filterInputRef);
  });

  const RepoTab = (props: {
    tab: "collections" | "backlinks" | "identity" | "blobs" | "logs";
    label: string;
  }) => {
    const isActive = () => {
      if (!location.hash) {
        if (!error() && props.tab === "collections") return true;
        if (!!error() && props.tab === "identity") return true;
        return false;
      }
      return location.hash.startsWith(`#${props.tab}`);
    };

    return (
      <A
        classList={{
          "border-b-2 font-medium transition-colors": true,
          "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
            !isActive(),
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
          <div class="flex justify-between px-2 text-sm sm:text-base">
            <div class="flex items-center gap-3 sm:gap-4">
              <Show when={!error()}>
                <RepoTab tab="collections" label="Collections" />
              </Show>
              <RepoTab tab="identity" label="Identity" />
              <Show when={did.startsWith("did:plc")}>
                <RepoTab tab="logs" label="Logs" />
              </Show>
              <Show when={!error()}>
                <RepoTab tab="blobs" label="Blobs" />
              </Show>
              <RepoTab tab="backlinks" label="Backlinks" />
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
                    href={`/jetstream?dids=${params.repo}`}
                    label="Jetstream"
                    icon="lucide--radio-tower"
                  />
                  <Show when={params.repo && params.repo in labelerCache}>
                    <NavMenu
                      href={`/labels?did=${params.repo}&uriPatterns=*`}
                      label="Labels"
                      icon="lucide--tag"
                    />
                  </Show>
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
                  <Show when={did.startsWith("did:plc")}>
                    <NavMenu
                      href={`${plcDirectory()}/${did}/log/audit`}
                      newTab
                      label="Audit log"
                      icon="lucide--external-link"
                    />
                  </Show>
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
            <Show when={nsids() && (!location.hash || location.hash.startsWith("#collections"))}>
              <div class="flex flex-col gap-1 pb-22 text-sm wrap-anywhere sm:gap-0">
                <Show
                  when={Object.keys(nsids() ?? {}).length != 0}
                  fallback={<span class="mt-3 text-center text-base">No collections found.</span>}
                >
                  <For
                    each={Object.keys(nsids() ?? {}).filter((authority) =>
                      filter()
                        ? authority.includes(filter()!) ||
                          displayNsidDomain(authority).includes(filter()!) ||
                          nsids()?.[authority].nsids.some((nsid) =>
                            `${authority}.${nsid}`.includes(filter()!),
                          )
                        : true,
                    )}
                  >
                    {(authority) => {
                      const isHighlighted = () => location.hash === `#collections:${authority}`;
                      const isCollapsed = () => nsids()?.[authority].hidden ?? false;
                      const domain = displayNsidDomain(authority);
                      const collectionCount = () => nsids()?.[authority].nsids.length ?? 0;

                      return (
                        <div
                          id={`collection-${authority}`}
                          class="group relative grid scroll-mt-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-2 sm:border-t sm:border-neutral-200 sm:py-1 sm:first:border-t-0 dark:sm:border-neutral-700"
                        >
                          <div class="dark:bg-dark-500 dark:after:from-dark-500 dark:after:via-dark-500/75 dark:sm:from-dark-500 relative sticky top-0 z-10 min-w-0 self-start bg-neutral-100 py-1 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-1 after:h-1 after:bg-linear-to-b after:from-neutral-100 after:via-neutral-100/75 after:to-transparent after:content-[''] sm:bg-transparent sm:bg-linear-to-b sm:from-neutral-100 sm:from-[70%] sm:to-transparent sm:after:hidden dark:sm:bg-transparent">
                            <Show when={isHighlighted()}>
                              <span class="absolute inset-y-0 -left-2 w-0.5 bg-blue-500 dark:bg-blue-400" />
                            </Show>
                            <div class="flex min-w-0 items-center gap-2">
                              <a
                                href={`#collections:${authority}`}
                                class="flex min-w-0 items-center gap-2 font-medium text-neutral-600 hover:text-neutral-900 hover:underline active:underline dark:text-neutral-300 dark:hover:text-neutral-100"
                                title={`${domain} (${authority})`}
                                aria-current={isHighlighted() ? "location" : undefined}
                              >
                                <Favicon domain={domain} />
                                <span class="min-w-0 truncate">{domain}</span>
                              </a>
                              <span class="h-px min-w-4 flex-1 bg-neutral-200 sm:hidden dark:bg-neutral-700" />
                            </div>
                          </div>
                          <div class="min-w-0 pl-4 sm:pl-0">
                            <Show
                              when={!isCollapsed()}
                              fallback={
                                <button
                                  class="flex min-h-7 w-full items-center px-2 text-left text-sm text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                                  aria-label={`Expand ${domain} collections`}
                                  onClick={() => toggleCollapsed(authority)}
                                >
                                  {collectionCount()}{" "}
                                  {collectionCount() === 1 ? "collection" : "collections"}
                                </button>
                              }
                            >
                              <div class="flex min-w-0 flex-1 flex-col px-2 py-1">
                                <For
                                  each={nsids()?.[authority].nsids.filter((nsid) =>
                                    filter() ? `${authority}.${nsid}`.includes(filter()!) : true,
                                  )}
                                >
                                  {(nsid, index) => (
                                    <A
                                      href={`/at://${did}/${authority}.${nsid}`}
                                      class="truncate hover:underline active:underline"
                                      classList={{ "pr-8": canHover && index() === 0 }}
                                      title={`${authority}.${nsid}`}
                                    >
                                      {nsid}
                                    </A>
                                  )}
                                </For>
                              </div>
                            </Show>
                          </div>
                          <Show when={canHover}>
                            <button
                              class="absolute top-1 right-2 flex size-6 items-center justify-center rounded-md text-neutral-400 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-200 hover:text-neutral-700 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none active:bg-neutral-300 sm:top-1.5 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 dark:active:bg-neutral-600"
                              aria-label={`${isCollapsed() ? "Expand" : "Collapse"} ${domain} collections`}
                              title={`${isCollapsed() ? "Expand" : "Collapse"} ${domain}`}
                              onClick={() => toggleCollapsed(authority)}
                            >
                              <span
                                class={`iconify ${isCollapsed() ? "lucide--chevron-down" : "lucide--chevron-up"}`}
                              />
                            </button>
                          </Show>
                        </div>
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
              class="w-full max-w-120"
              inputRef={(input) => (filterInputRef = input)}
              name="filter"
              placeholder="Filter collections..."
              value={filter() ?? ""}
              onInput={(value) => setFilter(value.toLowerCase())}
            />
            <div class="flex w-full max-w-120 justify-end gap-1">
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
