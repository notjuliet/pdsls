import { createSignal, For, Show, createResource } from "solid-js";
import { Client, CredentialManager } from "@atcute/client";
import { A, query, useParams } from "@solidjs/router";
import { didDocCache, getAllBacklinks, LinkData, resolvePDS } from "../utils/api.js";
import { Backlinks } from "../components/backlinks.jsx";
import { ActorIdentifier } from "@atcute/lexicons";
import { DidDocument } from "@atcute/identity";

const RepoView = () => {
  const params = useParams();
  const [error, setError] = createSignal<string>();
  const [downloading, setDownloading] = createSignal(false);
  const [didDoc, setDidDoc] = createSignal<DidDocument>();
  const [backlinks, setBacklinks] = createSignal<{
    links: LinkData;
    target: string;
  }>();
  const [nsids, setNsids] = createSignal<Record<string, { hidden: boolean; nsids: string[] }>>();
  const [allCollapsed, setAllCollapsed] = createSignal(false);
  const [tab, setTab] = createSignal<"collections" | "backlinks" | "doc">("collections");
  let rpc: Client;
  let pds: string;
  const did = params.repo;

  const describeRepo = query(
    (repo: string) =>
      rpc.get("com.atproto.repo.describeRepo", { params: { repo: repo as ActorIdentifier } }),
    "describeRepo",
  );

  const fetchRepo = async () => {
    pds = await resolvePDS(did);
    setDidDoc(didDocCache[did] as DidDocument);

    rpc = new Client({ handler: new CredentialManager({ service: pds }) });
    const res = await describeRepo(did);
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

      // Initialize allCollapsed based on if all collections are hidden
      setAllCollapsed(Object.keys(collections).every((authority) => collections[authority].hidden));
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
          break;
      }
      setTab("doc");
    }

    if (localStorage.backlinks === "true") {
      try {
        const backlinks = await getAllBacklinks(did);
        setBacklinks({ links: backlinks.links, target: did });
      } catch (e) {
        console.error(e);
      }
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

  const toggleAllCollections = () => {
    const newState = !allCollapsed();
    setAllCollapsed(newState);

    const updatedNsids = { ...nsids() };
    Object.keys(updatedNsids).forEach((authority) => {
      updatedNsids[authority].hidden = newState;
    });

    setNsids(updatedNsids);
  };

  return (
    <Show when={repo()}>
      <div class="mt-3 flex w-[21rem] flex-col gap-2 break-words sm:w-[23rem]">
        <Show when={error()}>
          <div class="rounded-md bg-red-100 p-2 text-sm text-red-700 dark:bg-red-50 dark:text-red-600">
            {error()}
          </div>
        </Show>
        <div class="flex divide-x divide-neutral-500 overflow-hidden rounded-lg border border-neutral-500">
          <Show when={!error()}>
            <button
              classList={{
                "flex flex-1 py-1 justify-center": true,
                "bg-neutral-200 dark:bg-dark-100 ": tab() === "collections",
                "bg-transparent hover:bg-zinc-200 dark:hover:bg-dark-400": tab() !== "collections",
              }}
              onclick={() => setTab("collections")}
            >
              Collections
            </button>
          </Show>
          <button
            classList={{
              "flex flex-1 py-1 justify-center": true,
              "bg-neutral-200 dark:bg-dark-100": tab() === "doc",
              "bg-transparent hover:bg-zinc-200 dark:hover:bg-dark-400": tab() !== "doc",
            }}
            onclick={() => setTab("doc")}
          >
            DID Doc
          </button>
          <Show when={backlinks()}>
            <button
              classList={{
                "flex flex-1 py-1 justify-center": true,
                "bg-neutral-200 dark:bg-dark-100": tab() === "backlinks",
                "bg-transparent hover:bg-zinc-200 dark:hover:bg-dark-400": tab() !== "backlinks",
              }}
              onclick={() => setTab("backlinks")}
            >
              Backlinks
            </button>
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
        <Show when={nsids() && tab() === "collections"}>
          <button
            class="flex w-fit items-center gap-2 bg-transparent"
            onclick={toggleAllCollections}
          >
            {allCollapsed() ?
              <div class="i-lucide-copy-plus text-lg" />
            : <div class="i-lucide-copy-minus text-lg" />}
            {allCollapsed() ? "Expand all" : "Collapse all"}
          </button>
          <div class="flex flex-col font-mono">
            <div class="grid grid-cols-[min-content_1fr] gap-x-1 items-center overflow-hidden text-sm">
              <For each={Object.keys(nsids() ?? {})}>
                {(authority) => (
                  <>
                    <Show when={nsids()?.[authority].hidden}>
                      <button
                        class="i-lucide-plus-square mr-1 text-lg"
                        onclick={() => toggleCollection(authority)}
                      />
                    </Show>
                    <Show when={!nsids()?.[authority].hidden}>
                      <button
                        class="i-lucide-minus-square mr-1 text-lg"
                        onclick={() => toggleCollection(authority)}
                      />
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
                        <For each={nsids()?.[authority].nsids}>
                          {(nsid) => (
                            <A
                              href={`/at://${did}/${authority}.${nsid}`}
                              class="text-lightblue-500 hover:underline"
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
              <div class="flex flex-col gap-y-1">
                <div>
                  <span class="font-semibold text-stone-600 dark:text-stone-400">ID </span>
                  <span>{didDocument().id}</span>
                </div>
                <div>
                  <p class="font-semibold text-stone-600 dark:text-stone-400">Identities</p>
                  <ul class="ml-3">
                    <For each={didDocument().alsoKnownAs}>{(alias) => <li>{alias}</li>}</For>
                  </ul>
                </div>
                <div>
                  <p class="font-semibold text-stone-600 dark:text-stone-400">Services</p>
                  <ul class="ml-3">
                    <For each={didDocument().service}>
                      {(service) => (
                        <li class="flex flex-col">
                          <span>#{service.id.split("#")[1]}</span>
                          <a
                            class="text-lightblue-500 w-fit hover:underline"
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
                  <ul class="ml-3">
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
                <a
                  class="text-lightblue-500 flex w-fit items-center hover:underline"
                  href={
                    did.startsWith("did:plc") ?
                      `${localStorage.plcDirectory ?? "https://plc.directory"}/${did}`
                    : `https://${did.split("did:web:")[1]}/.well-known/did.json`
                  }
                  target="_blank"
                >
                  DID document <div class="i-lucide-external-link ml-0.5 text-sm" />
                </a>
                <Show when={did.startsWith("did:plc")}>
                  <a
                    class="text-lightblue-500 flex w-fit items-center hover:underline"
                    href={`https://boat.kelinci.net/plc-oplogs?q=${did}`}
                    target="_blank"
                  >
                    PLC operation logs <div class="i-lucide-external-link ml-0.5 text-sm" />
                  </a>
                </Show>
                <Show when={error()?.length === 0 || error() === undefined}>
                  <div class="flex items-center gap-1">
                    <button
                      onclick={() => downloadRepo()}
                      class="text-lightblue-500 bg-transparent hover:underline"
                    >
                      Export repo
                    </button>
                    <Show when={downloading()}>
                      <div class="i-eos-icons-loading text-xl" />
                    </Show>
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
