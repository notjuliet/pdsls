import { Client, simpleFetchHandler } from "@atcute/client";
import { DidDocument } from "@atcute/identity";
import { ActorIdentifier, Did, Handle, Nsid } from "@atcute/lexicons";
import { Title } from "@solidjs/meta";
import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import {
  createEffect,
  createResource,
  createSignal,
  ErrorBoundary,
  For,
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
import { Favicon } from "../components/favicon.jsx";
import {
  addNotification,
  removeNotification,
  updateNotification,
} from "../components/notification.jsx";
import { canHover } from "../layout.jsx";
import {
  didDocCache,
  type HandleResolveResult,
  labelerCache,
  resolveHandle,
  resolveHandleDetailed,
  resolveLexiconAuthority,
  resolvePDS,
  validateHandle,
} from "../utils/api.js";
import { detectDidKeyType, detectKeyType } from "../utils/key.js";
import { BlobView } from "./blob.jsx";
import { PlcLogView } from "./logs.jsx";
import { plcDirectory } from "./settings.jsx";

export const RepoView = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = createSignal<string>();
  const [downloading, setDownloading] = createSignal(false);
  const [didDoc, setDidDoc] = createSignal<DidDocument>();
  const [nsids, setNsids] = createSignal<Record<string, { hidden: boolean; nsids: string[] }>>();
  const [filter, setFilter] = createSignal<string>();
  const [validHandles, setValidHandles] = createStore<Record<string, boolean>>({});
  const [rotationKeys, setRotationKeys] = createSignal<Array<string>>([]);
  const [expandedAlias, setExpandedAlias] = createSignal<string | null>(null);
  const [handleDetailedResult, setHandleDetailedResult] = createSignal<{
    dns: HandleResolveResult;
    http: HandleResolveResult;
  } | null>(null);
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
          "border-b-2 font-medium transition-colors": true,
          "border-transparent text-neutral-600 dark:text-neutral-300/80 hover:text-neutral-900 dark:hover:text-neutral-100":
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
    try {
      pds = await resolvePDS(did);
      setDidDoc(didDocCache[did] as DidDocument);
    } catch {
      // Fallback for feedgens
      if (did.startsWith("did:web")) {
        try {
          const res = await fetch(`https://${did.replace("did:web:", "")}/.well-known/did.json`);
          const didDoc = await res.json();
          setDidDoc(didDoc);
        } catch {}
      } else if (!did.startsWith("did:")) {
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

    if (did.startsWith("did:plc")) getRotationKeys();
    validateHandles();

    if (!pds) {
      setError("Missing PDS");
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
    const abortController = new AbortController();

    try {
      setDownloading(true);
      notificationId = addNotification({
        message: "Downloading repository...",
        progress: 0,
        total: 0,
        type: "info",
        onCancel: () => {
          abortController.abort();
          if (notificationId) {
            removeNotification(notificationId);
          }
        },
      });

      const response = await fetch(`${pds}/xrpc/com.atproto.sync.getRepo?did=${did}`, {
        signal: abortController.signal,
      });
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
    setDownloading(false);
  };

  const getTitle = () => {
    const doc = didDoc();
    const handle = doc?.alsoKnownAs
      ?.find((alias) => alias.startsWith("at://"))
      ?.replace("at://", "");
    return `${handle || params.repo} - PDSls`;
  };

  return (
    <>
      <Title>{getTitle()}</Title>
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
                <div class="flex items-center gap-1 rounded-md border border-red-500 px-1.5 py-0.5 text-xs font-medium text-red-500 sm:text-sm dark:border-red-400 dark:text-red-400">
                  <span
                    class={`iconify ${
                      error() === "Deactivated" ? "lucide--user-round-x"
                      : error() === "Takendown" ? "lucide--shield-ban"
                      : "lucide--unplug"
                    }`}
                  ></span>
                  <span>{error()}</span>
                </div>
              </Show>
              <MenuProvider>
                <DropdownMenu icon="lucide--ellipsis" buttonClass="rounded-sm p-1.5">
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
                      icon={
                        downloading() ? "lucide--loader-circle animate-spin" : "lucide--download"
                      }
                      onClick={() => downloadRepo()}
                    />
                  </Show>
                  <MenuSeparator />
                  <NavMenu
                    href={
                      did.startsWith("did:plc") ?
                        `${plcDirectory()}/${did}`
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
              <div class={`flex flex-col ${canHover ? "pb-16" : "pb-12"} text-sm wrap-anywhere`}>
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
                      const isHighlighted = () => location.hash === `#collections:${authority}`;

                      return (
                        <div
                          id={`collection-${authority}`}
                          class="group flex items-start gap-2 rounded-lg p-1 transition-colors"
                          classList={{
                            "dark:hover:bg-dark-300 hover:bg-neutral-200": !isHighlighted(),
                            "bg-blue-100 dark:bg-blue-500/25": isHighlighted(),
                          }}
                        >
                          <Favicon
                            authority={authority}
                            wrapper={(children) => (
                              <a
                                href={`#collections:${authority}`}
                                class="relative flex h-5 w-4 shrink-0 items-center justify-center hover:opacity-70"
                              >
                                <span class="absolute top-1/2 -left-5 flex -translate-y-1/2 items-center text-base opacity-0 transition-opacity group-hover:opacity-100">
                                  <span class="iconify lucide--link absolute -left-2 w-7"></span>
                                </span>
                                {children}
                              </a>
                            )}
                          />
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
                                  <span class="text-neutral-500 dark:text-neutral-400">
                                    .{nsid}
                                  </span>
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
                      <div class="font-semibold">DID</div>
                      <div class="text-sm text-neutral-700 dark:text-neutral-300">
                        {didDocument().id}
                      </div>
                    </div>

                    {/* Aliases Section */}
                    <Show when={didDocument().alsoKnownAs}>
                      <div>
                        <p class="font-semibold">Aliases</p>
                        <For each={didDocument().alsoKnownAs}>
                          {(alias) => (
                            <Show
                              when={alias.startsWith("at://")}
                              fallback={
                                <div class="text-sm text-neutral-700 dark:text-neutral-300">
                                  {alias}
                                </div>
                              }
                            >
                              <div class="flex flex-col gap-2">
                                <button
                                  class="-ml-1 flex w-fit items-center gap-1 rounded px-1 py-0.5 text-sm text-neutral-700 hover:bg-neutral-200 active:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"
                                  onClick={async () => {
                                    if (expandedAlias() === alias) {
                                      setExpandedAlias(null);
                                    } else {
                                      setHandleDetailedResult(null);
                                      setExpandedAlias(alias);
                                      const handle = alias.replace("at://", "") as Handle;
                                      const result = await resolveHandleDetailed(handle);
                                      if (expandedAlias() === alias)
                                        setHandleDetailedResult(result);
                                    }
                                  }}
                                >
                                  <span>{alias}</span>
                                  <span
                                    classList={{
                                      "iconify text-base lucide--check text-green-600 dark:text-green-400":
                                        validHandles[alias] === true,
                                      "iconify lucide--x text-red-500 dark:text-red-400":
                                        validHandles[alias] === false,
                                      "iconify lucide--loader-circle animate-spin":
                                        validHandles[alias] === undefined,
                                    }}
                                  ></span>
                                </button>

                                {/* Inline expansion */}
                                <Show when={expandedAlias() === alias}>
                                  <div class="mb-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
                                    <Show
                                      when={handleDetailedResult()}
                                      fallback={
                                        <div class="flex items-center gap-2 py-2 text-sm">
                                          <span class="iconify lucide--loader-circle animate-spin"></span>
                                          <span>Resolving handle...</span>
                                        </div>
                                      }
                                    >
                                      {(result) => {
                                        const expectedDid = didDocument().id;
                                        const dnsOk = () =>
                                          result().dns.success && result().dns.did === expectedDid;
                                        const httpOk = () =>
                                          result().http.success &&
                                          result().http.did === expectedDid;
                                        const dnsMismatch = () =>
                                          result().dns.success && result().dns.did !== expectedDid;
                                        const httpMismatch = () =>
                                          result().http.success &&
                                          result().http.did !== expectedDid;

                                        return (
                                          <div class="grid grid-cols-[auto_1fr] items-center gap-x-1.5 text-sm">
                                            {/* DNS Result */}
                                            <span
                                              classList={{
                                                "iconify lucide--check text-green-600 dark:text-green-400":
                                                  dnsOk(),
                                                "iconify lucide--x text-red-500 dark:text-red-400":
                                                  !dnsOk(),
                                              }}
                                            ></span>
                                            <span class="font-medium">DNS (TXT record)</span>
                                            <span></span>
                                            <div class="mb-2 text-sm wrap-anywhere text-neutral-500 dark:text-neutral-400">
                                              <Show
                                                when={result().dns.success}
                                                fallback={
                                                  <div class="text-red-500 dark:text-red-400">
                                                    {result().dns.error}
                                                  </div>
                                                }
                                              >
                                                <div>{result().dns.did}</div>
                                                <Show when={dnsMismatch()}>
                                                  <div class="text-red-500 dark:text-red-400">
                                                    Expected: {expectedDid}
                                                  </div>
                                                </Show>
                                              </Show>
                                            </div>

                                            {/* HTTP Result */}
                                            <span
                                              classList={{
                                                "iconify lucide--check text-green-600 dark:text-green-400":
                                                  httpOk(),
                                                "iconify lucide--x text-red-500 dark:text-red-400":
                                                  !httpOk(),
                                              }}
                                            ></span>
                                            <span class="font-medium">HTTP (.well-known)</span>
                                            <span></span>
                                            <div class="text-sm wrap-anywhere text-neutral-500 dark:text-neutral-400">
                                              <Show
                                                when={result().http.success}
                                                fallback={
                                                  <div class="text-red-500 dark:text-red-400">
                                                    {result().http.error}
                                                  </div>
                                                }
                                              >
                                                <div>{result().http.did}</div>
                                                <Show when={httpMismatch()}>
                                                  <div class="text-red-500 dark:text-red-400">
                                                    Expected: {expectedDid}
                                                  </div>
                                                </Show>
                                              </Show>
                                            </div>
                                          </div>
                                        );
                                      }}
                                    </Show>
                                  </div>
                                </Show>
                              </div>
                            </Show>
                          )}
                        </For>
                      </div>
                    </Show>

                    {/* Services Section */}
                    <Show when={didDocument().service}>
                      <div>
                        <p class="font-semibold">Services</p>
                        <div class="flex flex-col gap-1">
                          <For each={didDocument().service}>
                            {(service) => (
                              <div class="grid grid-cols-[auto_1fr] items-center gap-x-1 text-sm text-neutral-700 dark:text-neutral-300">
                                <span class="iconify lucide--hash"></span>
                                <div class="flex items-center gap-2">
                                  <span>{service.id.split("#")[1]}</span>
                                  <div class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                                    <span
                                      class="iconify text-xs"
                                      classList={{
                                        "lucide--hard-drive":
                                          service.type === "AtprotoPersonalDataServer",
                                        "lucide--tag": service.type === "AtprotoLabeler",
                                        "lucide--rss": service.type === "BskyFeedGenerator",
                                        "lucide--wrench": ![
                                          "AtprotoPersonalDataServer",
                                          "AtprotoLabeler",
                                          "BskyFeedGenerator",
                                        ].includes(service.type.toString()),
                                      }}
                                    ></span>
                                    <span>{service.type}</span>
                                  </div>
                                </div>
                                <span></span>
                                <a
                                  class="w-fit underline hover:text-blue-500 dark:hover:text-blue-400"
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
                    </Show>

                    {/* Verification Methods Section */}
                    <Show when={didDocument().verificationMethod}>
                      <div>
                        <p class="font-semibold">Verification Methods</p>
                        <div class="flex flex-col gap-1">
                          <For each={didDocument().verificationMethod}>
                            {(verif) => (
                              <Show when={verif.publicKeyMultibase}>
                                {(key) => (
                                  <div class="grid grid-cols-[auto_1fr] items-center gap-x-1 text-sm text-neutral-700 dark:text-neutral-300">
                                    <span class="iconify lucide--hash"></span>
                                    <div class="flex items-center gap-2">
                                      <span>{verif.id.split("#")[1]}</span>
                                      <div class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                                        <span class="iconify lucide--key-round text-xs"></span>
                                        <span>{detectKeyType(key())}</span>
                                      </div>
                                    </div>
                                    <span></span>
                                    <div class="font-mono break-all">{key()}</div>
                                  </div>
                                )}
                              </Show>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>

                    {/* Rotation Keys Section */}
                    <Show when={rotationKeys().length > 0}>
                      <div>
                        <p class="font-semibold">Rotation Keys</p>
                        <div class="flex flex-col gap-1">
                          <For each={rotationKeys()}>
                            {(key) => (
                              <div class="grid grid-cols-[auto_1fr] items-center gap-x-1 text-sm text-neutral-700 dark:text-neutral-300">
                                <span class="iconify lucide--key-round"></span>
                                <span>{detectDidKeyType(key)}</span>
                                <span></span>
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

      <Show when={nsids() && (!location.hash || location.hash.startsWith("#collections"))}>
        <div class={`fixed ${canHover ? "bottom-12" : "bottom-8"} z-10 w-full max-w-lg`}>
          <div
            class="dark:bg-dark-200 dark:shadow-dark-700 mx-3 flex cursor-text items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 shadow-sm dark:border-neutral-700"
            onClick={(e) => {
              const input = e.currentTarget.querySelector("input");
              if (e.target !== input) input?.focus();
            }}
          >
            <span class="iconify lucide--filter text-neutral-500 dark:text-neutral-400"></span>
            <input
              type="text"
              spellcheck={false}
              autocapitalize="off"
              autocomplete="off"
              class="grow py-2 select-none placeholder:text-sm focus:outline-none"
              name="filter"
              placeholder="Filter collections..."
              value={filter() ?? ""}
              onInput={(e) => setFilter(e.currentTarget.value.toLowerCase())}
            />
          </div>
        </div>
      </Show>
    </>
  );
};
