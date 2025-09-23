import { Client, CredentialManager } from "@atcute/client";
import { parsePublicMultikey } from "@atcute/crypto";
import { DidDocument } from "@atcute/identity";
import { ActorIdentifier, Did, Handle } from "@atcute/lexicons";
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
import { ActionMenu, DropdownMenu, MenuProvider, NavMenu } from "../components/dropdown.jsx";
import { TextInput } from "../components/text-input.jsx";
import Tooltip from "../components/tooltip.jsx";
import { didDocCache, resolveHandle, resolvePDS, validateHandle } from "../utils/api.js";
import { BlobView } from "./blob.jsx";
import { PlcLogView } from "./logs.jsx";

type Tab = "collections" | "backlinks" | "identity" | "blobs" | "logs";
const RepoView = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = createSignal<string>();
  const [downloading, setDownloading] = createSignal(false);
  const [didDoc, setDidDoc] = createSignal<DidDocument>();
  const [nsids, setNsids] = createSignal<Record<string, { hidden: boolean; nsids: string[] }>>();
  const [filter, setFilter] = createSignal<string>();
  const [validHandles, setValidHandles] = createStore<Record<string, boolean>>({});
  let rpc: Client;
  let pds: string;
  const did = params.repo;

  const RepoTab = (props: { tab: Tab; label: string }) => (
    <A class="group flex justify-center" href={`/at://${params.repo}#${props.tab}`}>
      <span
        classList={{
          "flex flex-1 border-b-2": true,
          "border-transparent group-hover:border-neutral-400 dark:group-hover:border-neutral-600":
            (location.hash !== `#${props.tab}` && !!location.hash) ||
            (!location.hash && props.tab !== "collections"),
        }}
      >
        {props.label}
      </span>
    </A>
  );

  const fetchRepo = async () => {
    try {
      pds = await resolvePDS(did);
    } catch {
      try {
        const did = await resolveHandle(params.repo as Handle);
        navigate(location.pathname.replace(params.repo, did));
      } catch {
        navigate(`/${did}`);
      }
    }
    setDidDoc(didDocCache[did] as DidDocument);

    rpc = new Client({ handler: new CredentialManager({ service: pds }) });
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
          setError("This repository has been deactivated");
          break;
        case "RepoTakendown":
          setError("This repository has been taken down");
          break;
        default:
          setError("This repository is unreachable");
      }
      navigate(`/at://${params.repo}#identity`);
    }

    return res.data;
  };

  const [repo] = createResource(fetchRepo);

  const downloadRepo = async () => {
    try {
      setDownloading(true);
      const response = await fetch(`${pds}/xrpc/com.atproto.sync.getRepo?did=${did}`);
      if (!response.ok) {
        throw new Error(`HTTP error status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${did}-${new Date().toISOString()}.car`;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    }
    setDownloading(false);
  };

  const toggleCollection = (authority: string) => {
    setNsids({
      ...nsids(),
      [authority]: { ...nsids()![authority], hidden: !nsids()![authority].hidden },
    });
  };

  createEffect(async () => {
    for (const alias of didDoc()?.alsoKnownAs ?? []) {
      if (alias.startsWith("at://"))
        setValidHandles(
          alias,
          await validateHandle(alias.replace("at://", "") as Handle, did as Did),
        );
    }
  });

  return (
    <Show when={repo()}>
      <div class="flex w-full flex-col gap-2 break-words">
        <Show when={error()}>
          <div class="rounded-lg bg-red-100 p-2 text-sm text-red-700 dark:bg-red-200 dark:text-red-600">
            {error()}
          </div>
        </Show>
        <div
          class={`dark:shadow-dark-800 dark:bg-dark-300 flex justify-between rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 px-2 py-1.5 text-sm shadow-xs dark:border-neutral-700`}
        >
          <div class="flex gap-2 sm:gap-4">
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
          <MenuProvider>
            <DropdownMenu
              icon="lucide--ellipsis-vertical"
              buttonClass="rounded-sm p-1"
              menuClass="top-8 p-2 text-sm"
            >
              <NavMenu
                href={`/jetstream?dids=${params.repo}`}
                label="Jetstream"
                icon="lucide--radio-tower"
              />
              <Show when={error()?.length === 0 || error() === undefined}>
                <ActionMenu
                  label="Export Repo"
                  icon={downloading() ? "lucide--loader-circle animate-spin" : "lucide--download"}
                  onClick={() => downloadRepo()}
                />
              </Show>
            </DropdownMenu>
          </MenuProvider>
        </div>
        <div class="flex w-full flex-col gap-2 px-2">
          <Show when={location.hash === "#logs"}>
            <ErrorBoundary fallback={(err) => <div class="break-words">Error: {err.message}</div>}>
              <Suspense
                fallback={
                  <div class="iconify lucide--loader-circle animate-spin self-center text-xl" />
                }
              >
                <PlcLogView did={did} />
              </Suspense>
            </ErrorBoundary>
          </Show>
          <Show when={location.hash === "#backlinks"}>
            <ErrorBoundary fallback={(err) => <div class="break-words">Error: {err.message}</div>}>
              <Suspense
                fallback={
                  <div class="iconify lucide--loader-circle animate-spin self-center text-xl" />
                }
              >
                <Backlinks target={did} />
              </Suspense>
            </ErrorBoundary>
          </Show>
          <Show when={location.hash === "#blobs"}>
            <ErrorBoundary fallback={(err) => <div class="break-words">Error: {err.message}</div>}>
              <Suspense
                fallback={
                  <div class="iconify lucide--loader-circle animate-spin self-center text-xl" />
                }
              >
                <BlobView pds={pds!} repo={did} />
              </Suspense>
            </ErrorBoundary>
          </Show>
          <Show when={nsids() && (!location.hash || location.hash === "#collections")}>
            <TextInput
              name="filter"
              placeholder="Filter collections"
              onInput={(e) => setFilter(e.currentTarget.value)}
              class="grow"
            />
            <div class="flex flex-col font-mono">
              <div class="grid grid-cols-[min-content_1fr] items-center gap-x-2 overflow-hidden text-sm">
                <For
                  each={Object.keys(nsids() ?? {}).filter((authority) =>
                    filter() ?
                      authority.startsWith(filter()!) || filter()?.startsWith(authority)
                    : true,
                  )}
                >
                  {(authority) => (
                    <>
                      <button onclick={() => toggleCollection(authority)} class="flex items-center">
                        <span
                          classList={{
                            "iconify lucide--chevron-down text-lg transition-transform": true,
                            "-rotate-90": nsids()?.[authority].hidden,
                          }}
                        ></span>
                      </button>
                      <button
                        class="bg-transparent text-left wrap-anywhere"
                        onclick={() => toggleCollection(authority)}
                      >
                        {authority}
                      </button>
                      <Show when={!nsids()?.[authority].hidden}>
                        <div></div>
                        <div class="flex flex-col">
                          <For
                            each={nsids()?.[authority].nsids.filter((nsid) =>
                              filter() ?
                                nsid.startsWith(filter()!.split(".").slice(2).join("."))
                              : true,
                            )}
                          >
                            {(nsid) => (
                              <A
                                href={`/at://${did}/${authority}.${nsid}`}
                                class="text-blue-400 hover:underline active:underline"
                              >
                                {authority}.{nsid}
                              </A>
                            )}
                          </For>
                        </div>
                      </Show>
                    </>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <Show when={location.hash === "#identity"}>
            <Show when={didDoc()}>
              {(didDocument) => (
                <div class="flex flex-col gap-y-1 wrap-anywhere">
                  <div class="flex items-baseline justify-between gap-2">
                    <div>
                      <div class="flex items-center gap-1">
                        <div class="iconify lucide--id-card" />
                        <p class="font-semibold">ID</p>
                      </div>
                      <div class="text-sm">{didDocument().id}</div>
                    </div>
                    <Tooltip text="DID document">
                      <a
                        href={
                          did.startsWith("did:plc") ?
                            `${localStorage.plcDirectory ?? "https://plc.directory"}/${did}`
                          : `https://${did.split("did:web:")[1]}/.well-known/did.json`
                        }
                        target="_blank"
                        class="-mr-1 flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                      >
                        <span class="iconify lucide--external-link"></span>
                      </a>
                    </Tooltip>
                  </div>
                  <div>
                    <div class="flex items-center gap-1">
                      <div class="iconify lucide--at-sign" />
                      <p class="font-semibold">Aliases</p>
                    </div>
                    <ul>
                      <For each={didDocument().alsoKnownAs}>
                        {(alias) => (
                          <li class="flex items-center gap-1 text-sm">
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
                                    "iconify lucide--circle-check": validHandles[alias] === true,
                                    "iconify lucide--circle-x text-red-500 dark:text-red-400":
                                      validHandles[alias] === false,
                                    "iconify lucide--loader-circle animate-spin":
                                      validHandles[alias] === undefined,
                                  }}
                                ></span>
                              </Tooltip>
                            </Show>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                  <div>
                    <div class="flex items-center gap-1">
                      <div class="iconify lucide--hard-drive" />
                      <p class="font-semibold">Services</p>
                    </div>
                    <ul>
                      <For each={didDocument().service}>
                        {(service) => (
                          <li class="flex flex-col text-sm">
                            <span>#{service.id.split("#")[1]}</span>
                            <a
                              class="w-fit text-blue-400 hover:underline active:underline"
                              href={service.serviceEndpoint.toString()}
                              target="_blank"
                            >
                              {service.serviceEndpoint.toString()}
                            </a>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                  <div>
                    <div class="flex items-center gap-1">
                      <div class="iconify lucide--shield-check" />
                      <p class="font-semibold">Verification methods</p>
                    </div>
                    <ul>
                      <For each={didDocument().verificationMethod}>
                        {(verif) => (
                          <Show when={verif.publicKeyMultibase}>
                            {(key) => (
                              <li class="flex flex-col text-sm">
                                <span>#{verif.id.split("#")[1]}</span>
                                <span class="flex items-center gap-0.5">
                                  <div class="iconify lucide--key-round" />
                                  <ErrorBoundary fallback={<>unknown</>}>
                                    {parsePublicMultikey(key()).type}
                                  </ErrorBoundary>
                                </span>
                                <span class="truncate">{key()}</span>
                              </li>
                            )}
                          </Show>
                        )}
                      </For>
                    </ul>
                  </div>
                </div>
              )}
            </Show>
          </Show>
        </div>
      </div>
    </Show>
  );
};

export { RepoView };
