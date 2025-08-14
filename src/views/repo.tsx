import { createSignal, For, Show, createResource, Suspense, ErrorBoundary } from "solid-js";
import { Client, CredentialManager } from "@atcute/client";
import { A, useParams } from "@solidjs/router";
import { didDocCache, resolvePDS } from "../utils/api.js";
import { Backlinks } from "../components/backlinks.jsx";
import { ActorIdentifier } from "@atcute/lexicons";
import { DidDocument } from "@atcute/identity";
import { BlobView } from "./blob.jsx";
import { TextInput } from "../components/text-input.jsx";
import Tooltip from "../components/tooltip.jsx";
import {
  CompatibleOperationOrTombstone,
  defs,
  IndexedEntry,
  processIndexedEntryLog,
} from "@atcute/did-plc";
import { createOperationHistory, DiffEntry, groupBy } from "../utils/plc-logs.js";
import { localDateFromTimestamp } from "../utils/date.js";

type Tab = "collections" | "backlinks" | "doc" | "blobs";
type PlcEvent = "handle" | "rotation_key" | "service" | "verification_method";

const PlcLogView = (props: {
  did: string;
  plcOps: [IndexedEntry<CompatibleOperationOrTombstone>, DiffEntry[]][];
}) => {
  const [activePlcEvent, setActivePlcEvent] = createSignal<PlcEvent | undefined>();

  const FilterButton = (props: { icon: string; event: PlcEvent }) => (
    <button
      classList={{
        "rounded-full p-1.5": true,
        "bg-neutral-700 dark:bg-neutral-200": activePlcEvent() === props.event,
      }}
      onclick={() => setActivePlcEvent(activePlcEvent() === props.event ? undefined : props.event)}
    >
      <div
        class={`${props.icon} text-xl ${activePlcEvent() === props.event ? "text-slate-100 dark:text-slate-900" : ""}`}
      />
    </button>
  );

  const DiffItem = (props: { diff: DiffEntry }) => {
    const diff = props.diff;
    let title = "Unknown log entry";
    let icon = "i-lucide-circle-help";
    let value = "";

    if (diff.type === "identity_created") {
      icon = "i-lucide-bell";
      title = `Identity created`;
    } else if (diff.type === "identity_tombstoned") {
      icon = "i-lucide-skull";
      title = `Identity tombstoned`;
    } else if (diff.type === "handle_added" || diff.type === "handle_removed") {
      icon = "i-lucide-at-sign";
      title = diff.type === "handle_added" ? "Alias added" : "Alias removed";
      value = diff.handle;
    } else if (diff.type === "handle_changed") {
      icon = "i-lucide-at-sign";
      title = "Alias updated";
      value = `${diff.prev_handle} → ${diff.next_handle}`;
    } else if (diff.type === "rotation_key_added" || diff.type === "rotation_key_removed") {
      icon = "i-lucide-key-round";
      title = diff.type === "rotation_key_added" ? "Rotation key added" : "Rotation key removed";
      value = diff.rotation_key;
    } else if (diff.type === "service_added" || diff.type === "service_removed") {
      icon = "i-lucide-server";
      title = `Service ${diff.service_id} ${diff.type === "service_added" ? "added" : "removed"}`;
      value = `${diff.service_endpoint}`;
    } else if (diff.type === "service_changed") {
      icon = "i-lucide-server";
      title = `Service ${diff.service_id} updated`;
      value = `${diff.prev_service_endpoint} → ${diff.next_service_endpoint}`;
    } else if (
      diff.type === "verification_method_added" ||
      diff.type === "verification_method_removed"
    ) {
      icon = "i-lucide-shield-check";
      title = `Verification method ${diff.method_id} ${diff.type === "verification_method_added" ? "added" : "removed"}`;
      value = `${diff.method_key}`;
    } else if (diff.type === "verification_method_changed") {
      icon = "i-lucide-shield-check";
      title = `Verification method ${diff.method_id} updated`;
      value = `${diff.prev_method_key} → ${diff.next_method_key}`;
    }

    return (
      <div class="grid grid-cols-[min-content_1fr] items-center gap-x-1">
        <div class={icon + ` shrink-0 text-lg`} />
        <p
          classList={{
            "font-semibold": true,
            "text-gray-500 line-through dark:text-gray-400": diff.orig.nullified,
          }}
        >
          {title}
        </p>
        <div></div>
        {value}
      </div>
    );
  };

  return (
    <>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1">
          <Tooltip text="Filter operations">
            <div class="i-lucide-filter text-xl" />
          </Tooltip>
          <div class="dark:shadow-dark-900/80 dark:bg-dark-300 flex w-fit items-center rounded-full bg-white shadow-sm">
            <FilterButton icon="i-lucide-at-sign" event="handle" />
            <FilterButton icon="i-lucide-key-round" event="rotation_key" />
            <FilterButton icon="i-lucide-server" event="service" />
            <FilterButton icon="i-lucide-shield-check" event="verification_method" />
          </div>
        </div>
        <Tooltip text="Audit log">
          <a
            href={`${localStorage.plcDirectory ?? "https://plc.directory"}/${props.did}/log/audit`}
            target="_blank"
          >
            <div class="i-lucide-external-link text-lg" />
          </a>
        </Tooltip>
      </div>
      <div class="flex flex-col gap-1 text-sm">
        <For each={props.plcOps}>
          {([entry, diffs]) => (
            <Show
              when={!activePlcEvent() || diffs.find((d) => d.type.startsWith(activePlcEvent()!))}
            >
              <div class="flex flex-col">
                <span class="text-neutral-500 dark:text-neutral-400">
                  {localDateFromTimestamp(new Date(entry.createdAt).getTime())}
                </span>
                {diffs.map((diff) => (
                  <Show when={!activePlcEvent() || diff.type.startsWith(activePlcEvent()!)}>
                    <DiffItem diff={diff} />
                  </Show>
                ))}
              </div>
            </Show>
          )}
        </For>
      </div>
    </>
  );
};

const RepoView = () => {
  const params = useParams();
  const [error, setError] = createSignal<string>();
  const [downloading, setDownloading] = createSignal(false);
  const [didDoc, setDidDoc] = createSignal<DidDocument>();
  const [nsids, setNsids] = createSignal<Record<string, { hidden: boolean; nsids: string[] }>>();
  const [tab, setTab] = createSignal<Tab>("collections");
  const [filter, setFilter] = createSignal<string>();
  const [plcOps, setPlcOps] =
    createSignal<[IndexedEntry<CompatibleOperationOrTombstone>, DiffEntry[]][]>();
  const [showPlcLogs, setShowPlcLogs] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [notice, setNotice] = createSignal<string>();
  let rpc: Client;
  let pds: string;
  const did = params.repo;

  const RepoTab = (props: { tab: Tab; label: string }) => (
    <button
      classList={{
        "rounded-full text-xs sm:text-sm flex flex-1 py-1.5 justify-center": true,
        "bg-white dark:bg-dark-300 shadow-sm dark:shadow-dark-900/80": tab() === props.tab,
        "bg-transparent hover:bg-zinc-200 dark:hover:bg-dark-200": tab() !== props.tab,
      }}
      onclick={() => setTab(props.tab)}
    >
      {props.label}
    </button>
  );

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
          <RepoTab tab="backlinks" label="Backlinks" />
        </div>
        <Show when={tab() === "backlinks"}>
          <ErrorBoundary fallback={(err) => <div class="break-words">Error: {err.message}</div>}>
            <Suspense
              fallback={<div class="i-lucide-loader-circle animate-spin self-center text-xl" />}
            >
              <Backlinks target={did} />
            </Suspense>
          </ErrorBoundary>
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
                    <button onclick={() => toggleCollection(authority)}>
                      <div
                        classList={{
                          "i-lucide-chevron-down text-lg transition-transform": true,
                          "-rotate-90": nsids()?.[authority].hidden,
                        }}
                      />
                    </button>
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
              <div class="break-anywhere flex flex-col gap-y-2">
                <div class="flex flex-col gap-y-1">
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
                </div>
                <div class="flex justify-between">
                  <Show when={did.startsWith("did:plc")}>
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        onclick={async () => {
                          if (!plcOps()) {
                            setLoading(true);
                            const response = await fetch(
                              `${localStorage.plcDirectory ?? "https://plc.directory"}/${did}/log/audit`,
                            );
                            const json = await response.json();
                            try {
                              const logs = defs.indexedEntryLog.parse(json);
                              await processIndexedEntryLog(did as any, logs);
                              const opHistory = createOperationHistory(logs).reverse();
                              setPlcOps(Array.from(groupBy(opHistory, (item) => item.orig)));
                              setLoading(false);
                            } catch (e: any) {
                              setNotice(e);
                              console.error(e);
                              setLoading(false);
                            }
                          }

                          setShowPlcLogs(!showPlcLogs());
                        }}
                        class="dark:hover:bg-dark-100 dark:bg-dark-300 dark:shadow-dark-900/80 flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-xs font-bold shadow-sm hover:bg-zinc-200/50"
                      >
                        <div class="i-lucide-logs text-sm" />
                        {showPlcLogs() ? "Hide" : "Show"} PLC Logs
                      </button>
                      <Show when={loading()}>
                        <div class="i-lucide-loader-circle animate-spin text-xl" />
                      </Show>
                    </div>
                  </Show>
                  <Show when={error()?.length === 0 || error() === undefined}>
                    <div
                      classList={{
                        "flex items-center gap-1": true,
                        "flex-row-reverse": did.startsWith("did:web"),
                      }}
                    >
                      <Show when={downloading()}>
                        <div class="i-lucide-loader-circle animate-spin text-xl" />
                      </Show>
                      <button
                        type="button"
                        onclick={() => downloadRepo()}
                        class="dark:hover:bg-dark-100 dark:bg-dark-300 dark:shadow-dark-900/80 flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-xs font-bold shadow-sm hover:bg-zinc-200/50"
                      >
                        <div class="i-lucide-download text-sm" />
                        Export Repo
                      </button>
                    </div>
                  </Show>
                </div>
                <Show when={showPlcLogs()}>
                  <Show when={notice()}>
                    <div>{notice()}</div>
                  </Show>
                  <PlcLogView plcOps={plcOps() ?? []} did={did} />
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
