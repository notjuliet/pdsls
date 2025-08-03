import {
  createSignal,
  For,
  Show,
  createResource,
  Suspense,
  ErrorBoundary,
  onMount,
  JSX,
} from "solid-js";
import { Client, CredentialManager } from "@atcute/client";
import { A, useParams } from "@solidjs/router";
import { didDocCache, getAllBacklinks, LinkData, resolvePDS } from "../utils/api.js";
import { Backlinks } from "../components/backlinks.jsx";
import { ActorIdentifier } from "@atcute/lexicons";
import { DidDocument } from "@atcute/identity";
import { BlobView } from "./blob.jsx";
import { TextInput } from "../components/text-input.jsx";
import Tooltip from "../components/tooltip.jsx";
import { CompatibleOperationOrTombstone, defs, IndexedEntry } from "@atcute/did-plc";
import { createOperationHistory, DiffEntry, groupBy } from "../utils/plc-logs.js";
import { localDateFromTimestamp } from "../utils/date.js";

type Tab = "collections" | "backlinks" | "doc" | "blobs";

const RepoView = () => {
  const params = useParams();
  const [error, setError] = createSignal<string>();
  const [downloading, setDownloading] = createSignal(false);
  const [didDoc, setDidDoc] = createSignal<DidDocument>();
  const [backlinks, setBacklinks] = createSignal<{ links: LinkData; target: string }>();
  const [nsids, setNsids] = createSignal<Record<string, { hidden: boolean; nsids: string[] }>>();
  const [tab, setTab] = createSignal<Tab>("collections");
  const [filter, setFilter] = createSignal<string>();
  const [plcOps, setPlcOps] =
    createSignal<[IndexedEntry<CompatibleOperationOrTombstone>, DiffEntry[]][]>();
  let rpc: Client;
  let pds: string;
  const did = params.repo;

  const RepoTab = (props: { tab: Tab; label: string }) => (
    <button
      classList={{
        "rounded-lg flex flex-1 py-1 justify-center": true,
        "bg-zinc-200/70 dark:bg-dark-200 shadow-sm dark:shadow-dark-900": tab() === props.tab,
        "bg-transparent hover:bg-zinc-200/50 dark:hover:bg-dark-300": tab() !== props.tab,
      }}
      onclick={() => setTab(props.tab)}
    >
      {props.label}
    </button>
  );

  const DiffItem = (props: { diff: DiffEntry }) => {
    const diff = props.diff;
    const nullified = diff.orig.nullified;

    let title = "Unknown log entry";
    let icon = "i-lucide-circle-help";
    let node: JSX.Element;

    if (diff.type === "identity_created") {
      icon = "i-lucide-bell";
      title = `Identity created`;
    } else if (diff.type === "identity_tombstoned") {
      icon = "i-lucide-skull";
      title = `Identity tombstoned`;
    } else if (diff.type === "handle_added") {
      icon = "i-lucide-at-sign";
      title = `Alias added`;
      node = diff.handle;
    } else if (diff.type === "handle_changed") {
      icon = "i-lucide-at-sign";
      title = `Alias updated`;
      node = `${diff.next_handle}`;
    } else if (diff.type === "handle_removed") {
      icon = "i-lucide-at-sign";
      title = `Alias removed`;
      node = diff.handle;
    } else if (diff.type === "rotation_key_added") {
      icon = "i-lucide-key-round";
      title = `Rotation key added`;
      node = diff.rotation_key;
    } else if (diff.type === "rotation_key_removed") {
      icon = "i-lucide-key-round";
      title = `Rotation key removed`;
      node = diff.rotation_key;
    } else if (diff.type === "service_added") {
      icon = "i-lucide-server";
      title = `Service ${diff.service_id} added`;
      node = `${diff.service_endpoint}`;
    } else if (diff.type === "service_changed") {
      icon = "i-lucide-server";
      title = `Service ${diff.service_id} updated`;
      node = `${diff.next_service_endpoint}`;
    } else if (diff.type === "service_removed") {
      icon = "i-lucide-server";
      title = `Service ${diff.service_id} removed`;
      node = `${diff.service_endpoint}`;
    } else if (diff.type === "verification_method_added") {
      icon = "i-lucide-shield-check";
      title = `Verification method ${diff.method_id} added`;
      node = `${diff.method_key}`;
    } else if (diff.type === "verification_method_changed") {
      icon = "i-lucide-shield-check";
      title = `Verification method ${diff.method_id} updated`;
      node = `${diff.next_method_key}`;
    } else if (diff.type === "verification_method_removed") {
      icon = "i-lucide-shield-check";
      title = `Verification method ${diff.method_id} removed`;
      node = `${diff.method_key}`;
    }

    return (
      <div class="grid grid-cols-[min-content_1fr] items-center">
        <div class={icon + ` mr-1 shrink-0 text-lg`} />
        <p class={!nullified ? ` ` : `text-gray-600 line-through`}>{title}</p>
        <div></div>
        {node}
      </div>
    );
  };

  const fetchRepo = async () => {
    pds = await resolvePDS(did);
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
      setTab("doc");
    }

    return res.data;
  };

  const [repo] = createResource(fetchRepo);

  onMount(async () => {
    if (localStorage.backlinks === "true") {
      try {
        const backlinks = await getAllBacklinks(did);
        setBacklinks({ links: backlinks.links, target: did });
      } catch (e) {
        console.error(e);
      }
    }

    const response = await fetch(`https://plc.directory/${did}/log/audit`);
    const json = await response.json();
    const logs = defs.indexedEntryLog.parse(json);
    const opHistory = createOperationHistory(logs).reverse();
    setPlcOps(Array.from(groupBy(opHistory, (item) => item.orig)));
  });

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

  return (
    <Show when={repo()}>
      <div class="mt-3 flex w-[21rem] flex-col gap-2 break-words sm:w-[24rem]">
        <Show when={error()}>
          <div class="rounded-md bg-red-100 p-2 text-sm text-red-700 dark:bg-red-200 dark:text-red-600">
            {error()}
          </div>
        </Show>
        <div class="flex gap-1 text-sm">
          <Show when={!error()}>
            <RepoTab tab="collections" label="Collections" />
          </Show>
          <RepoTab tab="doc" label="DID Doc" />
          <Show when={!error()}>
            <RepoTab tab="blobs" label="Blobs" />
          </Show>
          <Show when={backlinks()}>
            <RepoTab tab="backlinks" label="Backlinks" />
          </Show>
        </div>
        <Show when={tab() === "backlinks"}>
          <Show when={backlinks()}>
            {(backlinks) => (
              <div class="">
                <Backlinks links={backlinks().links} target={backlinks().target} />
              </div>
            )}
          </Show>
        </Show>
        <Show when={tab() === "blobs"}>
          <ErrorBoundary fallback={(err) => <div class="break-words">Error: {err.message}</div>}>
            <Suspense
              fallback={<div class="i-lucide-loader-circle animate-spin self-center text-xl" />}
            >
              <BlobView pds={pds!} repo={did} />
            </Suspense>
          </ErrorBoundary>
        </Show>
        <Show when={nsids() && tab() === "collections"}>
          <TextInput
            placeholder="Filter collections"
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
          <div class="flex flex-col font-mono">
            <div class="grid grid-cols-[min-content_1fr] items-center gap-x-1 overflow-hidden text-sm">
              <For
                each={Object.keys(nsids() ?? {}).filter((authority) =>
                  filter() ?
                    authority.startsWith(filter()!) || filter()?.startsWith(authority)
                  : true,
                )}
              >
                {(authority) => (
                  <>
                    <Show when={nsids()?.[authority].hidden}>
                      <button onclick={() => toggleCollection(authority)}>
                        <div class="i-lucide-chevron-right mr-1 text-lg" />
                      </button>
                    </Show>
                    <Show when={!nsids()?.[authority].hidden}>
                      <button onclick={() => toggleCollection(authority)}>
                        <div class="i-lucide-chevron-down mr-1 text-lg" />
                      </button>
                    </Show>
                    <button
                      class="break-anywhere bg-transparent text-left"
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
                              class="text-blue-400 hover:underline"
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
        <Show when={tab() === "doc"}>
          <Show when={didDoc()}>
            {(didDocument) => (
              <div class="break-anywhere flex flex-col gap-y-1">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <span class="font-semibold text-stone-600 dark:text-stone-400">ID </span>
                    <span>{didDocument().id}</span>
                  </div>
                  <Tooltip text="DID Document">
                    <a
                      href={
                        did.startsWith("did:plc") ?
                          `${localStorage.plcDirectory ?? "https://plc.directory"}/${did}`
                        : `https://${did.split("did:web:")[1]}/.well-known/did.json`
                      }
                      target="_blank"
                    >
                      <div class="i-lucide-external-link text-lg" />
                    </a>
                  </Tooltip>
                </div>
                <div>
                  <p class="font-semibold text-stone-600 dark:text-stone-400">Identities</p>
                  <ul class="ml-2">
                    <For each={didDocument().alsoKnownAs}>{(alias) => <li>{alias}</li>}</For>
                  </ul>
                </div>
                <div>
                  <p class="font-semibold text-stone-600 dark:text-stone-400">Services</p>
                  <ul class="ml-2">
                    <For each={didDocument().service}>
                      {(service) => (
                        <li class="flex flex-col">
                          <span>#{service.id.split("#")[1]}</span>
                          <a
                            class="w-fit text-blue-400 hover:underline"
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
                  <p class="font-semibold text-stone-600 dark:text-stone-400">
                    Verification methods
                  </p>
                  <ul class="ml-2">
                    <For each={didDocument().verificationMethod}>
                      {(verif) => (
                        <li class="flex flex-col">
                          <span>#{verif.id.split("#")[1]}</span>
                          <span>{verif.publicKeyMultibase}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
                <Show when={error()?.length === 0 || error() === undefined}>
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      onclick={() => downloadRepo()}
                      class="dark:hover:bg-dark-100 dark:bg-dark-300 focus:outline-1.5 dark:shadow-dark-900 flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-xs font-bold shadow-sm hover:bg-zinc-200/50 focus:outline-slate-900 dark:focus:outline-slate-100"
                    >
                      <div class="i-lucide-download text-sm" />
                      Export Repo
                    </button>
                    <Show when={downloading()}>
                      <div class="i-lucide-loader-circle animate-spin text-xl" />
                    </Show>
                  </div>
                </Show>
                <Show when={did.startsWith("did:plc")}>
                  <div class="flex flex-col gap-1">
                    <For each={plcOps()}>
                      {([entry, diffs]) => (
                        <div class="flex flex-col">
                          <span>{localDateFromTimestamp(new Date(entry.createdAt).getTime())}</span>
                          {diffs.map((diff) => (
                            <DiffItem diff={diff} />
                          ))}
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </Show>
      </div>
    </Show>
  );
};

export { RepoView };
