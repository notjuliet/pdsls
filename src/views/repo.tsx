import { Client, simpleFetchHandler } from "@atcute/client";
import { DidDocument } from "@atcute/identity";
import { ActorIdentifier, Did, Handle, Nsid } from "@atcute/lexicons";
import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import {
  createEffect,
  createResource,
  createSignal,
  ErrorBoundary,
  For,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Backlinks } from "../components/backlinks.jsx";
import {
  ActionMenu,
  CopyMenu,
  DropdownMenu,
  MenuProvider,
  MenuSeparator,
  NavMenu,
} from "../components/dropdown.jsx";
import { setPDS } from "../components/navbar.jsx";
import {
  addNotification,
  removeNotification,
  updateNotification,
} from "../components/notification.jsx";
import { TextInput } from "../components/text-input.jsx";
import Tooltip from "../components/tooltip.jsx";
import {
  didDocCache,
  labelerCache,
  resolveHandle,
  resolveLexiconAuthority,
  resolvePDS,
  validateHandle,
} from "../utils/api.js";
import { detectDidKeyType, detectKeyType } from "../utils/key.js";
import { BlobView } from "./blob.jsx";
import { PlcLogView } from "./logs.jsx";

export const RepoView = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = createSignal<string>();
  const [downloading, setDownloading] = createSignal(false);
  const [didDoc, setDidDoc] = createSignal<DidDocument>();
  const [nsids, setNsids] = createSignal<Record<string, { hidden: boolean; nsids: string[] }>>();
  const [filter, setFilter] = createSignal<string>();
  const [showFilter, setShowFilter] = createSignal(false);
  const [validHandles, setValidHandles] = createStore<Record<string, boolean>>({});
  const [rotationKeys, setRotationKeys] = createSignal<Array<string>>([]);
  let rpc: Client;
  let pds: string;
  const did = params.repo!;

  // Handle scrolling to a collection group when hash is like #collections:app.bsky
  createEffect(() => {
    const hash = location.hash;
    if (hash.startsWith("#collections:")) {
      const authority = hash.slice(13);
      requestAnimationFrame(() => {
        const element = document.getElementById(`collection-${authority}`);
        if (element) element.scrollIntoView({ behavior: "instant", block: "start" });
      });
    }
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
      if (props.tab === "collections")
        return location.hash === "#collections" || location.hash.startsWith("#collections:");
      return location.hash === `#${props.tab}`;
    };

    return (
      <A
        classList={{
          "border-b-2 font-medium": true,
          "border-transparent text-neutral-600 dark:text-neutral-300/80 hover:border-neutral-600 dark:hover:border-neutral-300/80":
            !isActive(),
        }}
        href={`/at://${params.repo}#${props.tab}`}
      >
        {props.label}
      </A>
    );
  };

  const getRotationKeys = async () => {
    const res = await fetch(
      `${localStorage.plcDirectory ?? "https://plc.directory"}/${did}/log/last`,
    );
    const json = await res.json();
    setRotationKeys(json.rotationKeys ?? []);
  };

  const fetchRepo = async () => {
    try {
      pds = await resolvePDS(did);
    } catch {
      if (!did.startsWith("did:")) {
        try {
          const did = await resolveHandle(params.repo as Handle);
          navigate(location.pathname.replace(params.repo!, did), { replace: true });
          return;
        } catch {
          try {
            const nsid = params.repo as Nsid;
            const res = await resolveLexiconAuthority(nsid);
            navigate(`/at://${res}/com.atproto.lexicon.schema/${nsid}`, { replace: true });
            return;
          } catch {
            navigate(`/${did}`, { replace: true });
            return;
          }
        }
      }
    }
    setDidDoc(didDocCache[did] as DidDocument);
    getRotationKeys();

    validateHandles();

    if (!pds) {
      setError("Missing PDS");
      setPDS("Missing PDS");
      return {};
    }

    rpc = new Client({ handler: simpleFetchHandler({ service: pds }) });
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
            setError("Takendown");
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

  const [repo] = createResource(fetchRepo);

  const validateHandles = async () => {
    for (const alias of didDoc()?.alsoKnownAs ?? []) {
      if (alias.startsWith("at://"))
        setValidHandles(
          alias,
          await validateHandle(alias.replace("at://", "") as Handle, did as Did),
        );
    }
  };

  const downloadRepo = async () => {
    let notificationId: string | null = null;

    try {
      setDownloading(true);
      notificationId = addNotification({
        message: "Downloading repository...",
        progress: 0,
        total: 0,
        type: "info",
      });

      const response = await fetch(`${pds}/xrpc/com.atproto.sync.getRepo?did=${did}`);
      if (!response.ok) {
        throw new Error(`HTTP error status: ${response.status}`);
      }

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
            const progress = Math.round((loaded / total) * 100);
            updateNotification(notificationId, {
              progress,
              total,
            });
          } else {
            const progressMB = Math.round((loaded / (1024 * 1024)) * 10) / 10;
            updateNotification(notificationId, {
              progress: progressMB,
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
      });
      setTimeout(() => {
        if (notificationId) removeNotification(notificationId);
      }, 3000);
    } catch (error) {
      console.error("Download failed:", error);
      if (notificationId) {
        updateNotification(notificationId, {
          message: "Download failed",
          type: "error",
          progress: undefined,
        });
        setTimeout(() => {
          if (notificationId) removeNotification(notificationId);
        }, 5000);
      }
    }
    setDownloading(false);
  };

  return (
    <Show when={repo()}>
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
              <div class="flex items-center gap-1 text-red-500 dark:text-red-400">
                <span class="iconify lucide--alert-triangle"></span>
                <span>{error()}</span>
              </div>
            </Show>
            <MenuProvider>
              <DropdownMenu icon="lucide--ellipsis-vertical" buttonClass="rounded-sm p-1.5">
                <Show
                  when={!error() && (!location.hash || location.hash.startsWith("#collections"))}
                >
                  <ActionMenu
                    label="Filter collections"
                    icon="lucide--filter"
                    onClick={() => setShowFilter(!showFilter())}
                  />
                </Show>
                <CopyMenu content={params.repo!} label="Copy DID" icon="lucide--copy" />
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
                    label="Export repo"
                    icon={downloading() ? "lucide--loader-circle animate-spin" : "lucide--download"}
                    onClick={() => downloadRepo()}
                  />
                </Show>
                <MenuSeparator />
                <NavMenu
                  href={
                    did.startsWith("did:plc") ?
                      `${localStorage.plcDirectory ?? "https://plc.directory"}/${did}`
                    : `https://${did.split("did:web:")[1]}/.well-known/did.json`
                  }
                  newTab
                  label="DID document"
                  icon="lucide--external-link"
                />
                <Show when={did.startsWith("did:plc")}>
                  <NavMenu
                    href={`${localStorage.plcDirectory ?? "https://plc.directory"}/${did}/log/audit`}
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
          <Show when={location.hash === "#logs"}>
            <ErrorBoundary
              fallback={(err) => <div class="wrap-break-word">Error: {err.message}</div>}
            >
              <Suspense
                fallback={
                  <div class="iconify lucide--loader-circle mt-2 animate-spin self-center text-xl" />
                }
              >
                <PlcLogView did={did} />
              </Suspense>
            </ErrorBoundary>
          </Show>
          <Show when={location.hash === "#backlinks"}>
            <ErrorBoundary
              fallback={(err) => <div class="wrap-break-word">Error: {err.message}</div>}
            >
              <Suspense
                fallback={
                  <div class="iconify lucide--loader-circle mt-2 animate-spin self-center text-xl" />
                }
              >
                <Backlinks target={did} />
              </Suspense>
            </ErrorBoundary>
          </Show>
          <Show when={location.hash === "#blobs"}>
            <ErrorBoundary
              fallback={(err) => <div class="wrap-break-word">Error: {err.message}</div>}
            >
              <Suspense
                fallback={
                  <div class="iconify lucide--loader-circle mt-2 animate-spin self-center text-xl" />
                }
              >
                <BlobView pds={pds!} repo={did} />
              </Suspense>
            </ErrorBoundary>
          </Show>
          <Show when={nsids() && (!location.hash || location.hash.startsWith("#collections"))}>
            <Show when={showFilter()}>
              <TextInput
                name="filter"
                placeholder="Filter collections"
                onInput={(e) => setFilter(e.currentTarget.value.toLowerCase())}
                class="grow"
                ref={(node) => {
                  onMount(() => node.focus());
                }}
              />
            </Show>
            <div class="flex flex-col text-sm wrap-anywhere" classList={{ "-mt-1": !showFilter() }}>
              <Show
                when={Object.keys(nsids() ?? {}).length != 0}
                fallback={<span class="mt-3 text-center text-base">No collections found.</span>}
              >
                <For
                  each={Object.keys(nsids() ?? {}).filter((authority) =>
                    filter() ?
                      authority.includes(filter()!) ||
                      nsids()?.[authority].nsids.some((nsid) =>
                        `${authority}.${nsid}`.includes(filter()!),
                      )
                    : true,
                  )}
                >
                  {(authority) => {
                    const reversedDomain = authority.split(".").reverse().join(".");
                    const [faviconLoaded, setFaviconLoaded] = createSignal(false);

                    const isHighlighted = () => location.hash === `#collections:${authority}`;

                    return (
                      <div
                        id={`collection-${authority}`}
                        class="group flex items-start gap-2 rounded-lg p-1 transition-colors"
                        classList={{
                          "dark:hover:bg-dark-200 hover:bg-neutral-200": !isHighlighted(),
                          "bg-blue-100 dark:bg-blue-500/25": isHighlighted(),
                        }}
                      >
                        <a
                          href={`#collections:${authority}`}
                          class="relative flex h-5 w-4 shrink-0 items-center justify-center hover:opacity-70"
                        >
                          <span class="absolute top-1/2 -left-5 flex -translate-y-1/2 items-center text-base opacity-0 transition-opacity group-hover:opacity-100">
                            <span class="iconify lucide--link absolute -left-2 w-7"></span>
                          </span>
                          <Show when={!faviconLoaded()}>
                            <span class="iconify lucide--globe size-4 text-neutral-400 dark:text-neutral-500" />
                          </Show>
                          <img
                            src={
                              ["bsky.app", "bsky.chat"].includes(reversedDomain) ?
                                "https://web-cdn.bsky.app/static/apple-touch-icon.png"
                              : `https://${reversedDomain}/favicon.ico`
                            }
                            alt={`${reversedDomain} favicon`}
                            class="h-4 w-4"
                            classList={{ hidden: !faviconLoaded() }}
                            onLoad={() => setFaviconLoaded(true)}
                            onError={() => setFaviconLoaded(false)}
                          />
                        </a>
                        <div class="flex flex-1 flex-col">
                          <For
                            each={nsids()?.[authority].nsids.filter((nsid) =>
                              filter() ? `${authority}.${nsid}`.includes(filter()!) : true,
                            )}
                          >
                            {(nsid) => (
                              <A
                                href={`/at://${did}/${authority}.${nsid}`}
                                class="hover:underline active:underline"
                              >
                                <span>{authority}</span>
                                <span class="text-neutral-500 dark:text-neutral-400">.{nsid}</span>
                              </A>
                            )}
                          </For>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </Show>
            </div>
          </Show>
          <Show when={location.hash === "#identity" || (error() && !location.hash)}>
            <Show when={didDoc()}>
              {(didDocument) => (
                <div class="flex flex-col gap-3 wrap-anywhere">
                  {/* ID Section */}
                  <div>
                    <div class="flex items-center gap-1">
                      <div class="iconify lucide--id-card" />
                      <p class="font-semibold">ID</p>
                    </div>
                    <div class="text-sm">{didDocument().id}</div>
                  </div>

                  {/* Aliases Section */}
                  <div>
                    <div class="flex items-center gap-1">
                      <div class="iconify lucide--at-sign" />
                      <p class="font-semibold">Aliases</p>
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <For each={didDocument().alsoKnownAs}>
                        {(alias) => (
                          <div class="flex items-center gap-1 text-sm">
                            <span>{alias}</span>
                            <Show when={alias.startsWith("at://")}>
                              <Tooltip
                                text={
                                  validHandles[alias] === true ? "Valid handle"
                                  : validHandles[alias] === undefined ?
                                    "Validating"
                                  : "Invalid handle"
                                }
                              >
                                <span
                                  classList={{
                                    "iconify lucide--circle-check text-green-600 dark:text-green-400":
                                      validHandles[alias] === true,
                                    "iconify lucide--circle-x text-red-500 dark:text-red-400":
                                      validHandles[alias] === false,
                                    "iconify lucide--loader-circle animate-spin":
                                      validHandles[alias] === undefined,
                                  }}
                                ></span>
                              </Tooltip>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>

                  {/* Services Section */}
                  <div>
                    <div class="flex items-center gap-1">
                      <div class="iconify lucide--hard-drive" />
                      <p class="font-semibold">Services</p>
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <For each={didDocument().service}>
                        {(service) => (
                          <div class="text-sm">
                            <div class="font-medium text-neutral-700 dark:text-neutral-300">
                              #{service.id.split("#")[1]}
                            </div>
                            <a
                              class="underline hover:text-blue-400"
                              href={service.serviceEndpoint.toString()}
                              target="_blank"
                              rel="noopener"
                            >
                              {service.serviceEndpoint.toString()}
                            </a>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>

                  {/* Verification Methods Section */}
                  <div>
                    <div class="flex items-center gap-1">
                      <div class="iconify lucide--shield-check" />
                      <p class="font-semibold">Verification Methods</p>
                    </div>
                    <div class="flex flex-col gap-0.5">
                      <For each={didDocument().verificationMethod}>
                        {(verif) => (
                          <Show when={verif.publicKeyMultibase}>
                            {(key) => (
                              <div class="text-sm">
                                <div class="flex items-baseline gap-1">
                                  <span class="font-medium text-neutral-700 dark:text-neutral-300">
                                    #{verif.id.split("#")[1]}
                                  </span>
                                  <span class="rounded bg-neutral-200 px-1 py-0.5 text-xs text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300">
                                    {detectKeyType(key())}
                                  </span>
                                </div>
                                <div class="font-mono break-all">{key()}</div>
                              </div>
                            )}
                          </Show>
                        )}
                      </For>
                    </div>
                  </div>

                  {/* Rotation Keys Section */}
                  <Show when={rotationKeys().length > 0}>
                    <div>
                      <div class="flex items-center gap-1">
                        <div class="iconify lucide--key-round" />
                        <p class="font-semibold">Rotation Keys</p>
                      </div>
                      <div class="flex flex-col gap-0.5">
                        <For each={rotationKeys()}>
                          {(key) => (
                            <div class="text-sm">
                              <span class="rounded bg-neutral-200 px-1 py-0.5 text-xs text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300">
                                {detectDidKeyType(key)}
                              </span>
                              <div class="font-mono break-all">{key.replace("did:key:", "")}</div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </Show>
        </div>
      </div>
    </Show>
  );
};
