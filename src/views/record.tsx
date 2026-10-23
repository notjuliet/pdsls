import { Client } from "@atcute/client";
import { ActorIdentifier, Nsid } from "@atcute/lexicons";
import { AtprotoDid, Did } from "@atcute/lexicons/syntax";
import { verifyRecord } from "@atcute/repo";
import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { createResource, createSignal, ErrorBoundary, For, Show, Suspense } from "solid-js";

import { agent } from "../auth/state";
import { Backlinks } from "../components/backlinks.jsx";
import { ConfirmDialog } from "../components/confirm-dialog.jsx";
import { RecordEditor, setPlaceholder } from "../components/create";
import {
  ActionMenu,
  CopyMenu,
  DropdownMenu,
  MenuProvider,
  NavMenu,
} from "../components/dropdown.jsx";
import { Favicon } from "../components/favicon.jsx";
import { IconButton } from "../components/icon-button.jsx";
import { JSONValue } from "../components/json.jsx";
import { addNotification } from "../components/notification.jsx";
import {
  RecordInfo,
  RecordPage,
  recordTabFromHash,
  useRecordSchemaValidation,
} from "../components/record-page.jsx";
import { Spinner } from "../components/spinner.jsx";
import { useRepo } from "../lib/repo-context.jsx";
import { SchemaTabContent, useLexiconSchema } from "../lib/schema-tab.jsx";
import { AtUri, uriTemplates } from "../lib/templates.js";
import { hideMedia, setHideMedia } from "./settings.jsx";

const faviconWrapper = (children: any) => (
  <div class="flex size-4 items-center justify-center">{children}</div>
);

const bskyAltClients = [
  {
    label: "Blacksky",
    hostname: "blacksky.app",
    transform: (url: string) => url.replace("https://bsky.app", "https://blacksky.community"),
  },
  {
    label: "Witchsky",
    hostname: "witchsky.app",
    transform: (url: string) => url.replace("https://bsky.app", "https://witchsky.app"),
  },
  {
    label: "Red Dwarf",
    hostname: "reddwarf.app",
    transform: (url: string) => url.replace("https://bsky.app", "https://reddwarf.app"),
  },
];

export const RecordView = () => {
  const repo = useRepo();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [openDelete, setOpenDelete] = createSignal(false);
  const [showAlternates, setShowAlternates] = createSignal(false);
  const [verifyError, setVerifyError] = createSignal("");
  const [externalLink, setExternalLink] = createSignal<
    { label: string; link: string; icon?: string } | undefined
  >();
  const [validRecord, setValidRecord] = createSignal<boolean | undefined>(undefined);
  const schemaValidation = useRecordSchemaValidation(
    () => params.collection!,
    () => params.rkey!,
  );
  const lexicon = useLexiconSchema(() => params.collection);
  const did = repo.did();

  const fetchRecord = async () => {
    const rpc = repo.rpc()!;
    const collection = params.collection!;
    const rkey = params.rkey!;
    setValidRecord(undefined);
    schemaValidation.reset();
    const res = await rpc.get("com.atproto.repo.getRecord", {
      params: {
        repo: did as ActorIdentifier,
        collection: collection as `${string}.${string}.${string}`,
        rkey,
      },
    });
    if (!res.ok) {
      setValidRecord(false);
      setVerifyError(res.data.error);
      throw new Error(res.data.error);
    }
    setPlaceholder(res.data.value);
    setExternalLink(checkUri(res.data.uri, res.data.value));
    verifyRecordIntegrity(rpc, collection, rkey);
    schemaValidation.validateLocal(res.data.value);

    return res.data;
  };

  const [record, { refetch }] = createResource(
    () => (repo.rpc() ? params.rkey : undefined),
    fetchRecord,
  );

  const verifyRecordIntegrity = async (rpc: Client, collection: string, rkey: string) => {
    try {
      const { ok, data } = await rpc.get("com.atproto.sync.getRecord", {
        params: {
          did: did as Did,
          collection: collection as Nsid,
          rkey,
        },
        as: "bytes",
      });
      if (!ok) throw data.error;

      await verifyRecord({
        did: did as AtprotoDid,
        collection,
        rkey,
        carBytes: data as Uint8Array<ArrayBufferLike>,
      });

      setValidRecord(true);
    } catch (err: any) {
      console.error("Record verification error:", err);
      setVerifyError(err.message);
      setValidRecord(false);
    }
  };

  const deleteRecord = async () => {
    const collection = params.collection!;
    const rkey = params.rkey!;
    const authRpc = new Client({ handler: agent()! });
    await authRpc.post("com.atproto.repo.deleteRecord", {
      input: {
        repo: params.repo as ActorIdentifier,
        collection: collection as `${string}.${string}.${string}`,
        rkey,
      },
    });
    addNotification({
      message: "Record deleted",
      type: "success",
      duration: 3000,
    });
    navigate(`/at://${params.repo}/${params.collection}`);
  };

  const checkUri = (uri: string, record: any) => {
    const uriParts = uri.split("/"); // expected: ["at:", "", "repo", "collection", "rkey"]
    if (uriParts.length != 5) return undefined;
    if (uriParts[0] !== "at:" || uriParts[1] !== "") return undefined;
    const parsedUri: AtUri = { repo: uriParts[2], collection: uriParts[3], rkey: uriParts[4] };
    const template = uriTemplates[parsedUri.collection];
    if (!template) return undefined;
    return template(parsedUri, record);
  };

  document.title = `${params.collection}/${params.rkey} - PDSls`;

  return (
    <>
      <ErrorBoundary
        fallback={(err) => (
          <div class="flex w-full flex-col items-center gap-1 px-2 py-4">
            <span class="font-semibold text-red-500 dark:text-red-400">Error loading record</span>
            <div class="max-w-full text-sm wrap-break-word text-neutral-600 dark:text-neutral-400">
              {err.message}
            </div>
          </div>
        )}
      >
        <Show when={record()} keyed>
          <RecordPage
            tabs={[
              { id: "record", label: "Record" },
              { id: "schema", label: "Schema" },
              { id: "backlinks", label: "Backlinks" },
              {
                id: "info",
                label: "Info",
                error: validRecord() === false || schemaValidation.valid() === false,
              },
            ]}
            activeTab={recordTabFromHash(location.hash)}
            tabHref={(tab) => `/at://${did}/${params.collection}/${params.rkey}#${tab}`}
            actions={
              <>
                <Show when={agent() && agent()?.sub === record()?.uri.split("/")[2]}>
                  <RecordEditor
                    create={false}
                    record={record()?.value}
                    refetch={refetch}
                    scope="update"
                  />
                  <IconButton
                    icon="lucide--trash-2"
                    label="Delete"
                    scope="delete"
                    onClick={() => setOpenDelete(true)}
                  />
                  <ConfirmDialog
                    open={openDelete()}
                    onClose={() => setOpenDelete(false)}
                    onConfirm={() => void deleteRecord()}
                    title="Delete this record?"
                    description="This cannot be undone."
                    confirmLabel="Delete"
                  />
                </Show>
                <Show when={externalLink()}>
                  {(link) => {
                    const bskyAlts = () =>
                      link().link.startsWith("https://bsky.app")
                        ? bskyAltClients.map((alt) => ({
                            ...alt,
                            link: alt.transform(link().link),
                          }))
                        : [];
                    return (
                      <div
                        class="relative"
                        onMouseEnter={() => setShowAlternates(true)}
                        onMouseLeave={() => setShowAlternates(false)}
                      >
                        <a
                          href={link().link}
                          target="_blank"
                          title={`Open on ${link().label}`}
                          class="flex p-1.5"
                          classList={{
                            "rounded-sm hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600":
                              !bskyAlts().length,
                            "bg-neutral-50 rounded-t dark:bg-dark-200 hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600":
                              showAlternates() && bskyAlts().length > 0,
                          }}
                        >
                          <Favicon
                            domain={new URL(link().link).hostname}
                            wrapper={faviconWrapper}
                          />
                        </a>
                        <Show when={bskyAlts().length > 0}>
                          <div
                            class="dark:bg-dark-200 absolute top-full left-0 z-10 flex flex-col overflow-hidden rounded-b bg-neutral-50 shadow-xs"
                            classList={{ invisible: !showAlternates() }}
                          >
                            <For each={bskyAlts()}>
                              {(alt) => (
                                <a
                                  href={alt.link}
                                  target="_blank"
                                  title={`Open on ${alt.label}`}
                                  class="flex p-1.5 hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                                >
                                  <Favicon domain={alt.hostname} wrapper={faviconWrapper} />
                                </a>
                              )}
                            </For>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </Show>
                <MenuProvider>
                  <DropdownMenu icon="lucide--ellipsis" buttonClass="rounded-sm p-1.5">
                    <CopyMenu
                      content={JSON.stringify(record()?.value, null, 2)}
                      label="Copy record"
                      icon="lucide--copy"
                    />
                    <NavMenu
                      href={`${repo.pds()}/xrpc/com.atproto.repo.getRecord?repo=${params.repo}&collection=${params.collection}&rkey=${params.rkey}`}
                      icon="lucide--external-link"
                      label="Record on PDS"
                      newTab
                    />
                    <ActionMenu
                      label={hideMedia() ? "Show media" : "Hide media"}
                      icon={hideMedia() ? "lucide--eye" : "lucide--eye-off"}
                      keepOpen
                      onClick={() => {
                        const next = !hideMedia();
                        localStorage.hideMedia = String(next);
                        setHideMedia(next);
                      }}
                    />
                  </DropdownMenu>
                </MenuProvider>
              </>
            }
            record={
              <JSONValue
                data={record()?.value as any}
                repo={record()!.uri.split("/")[2]}
                pds={repo.pds()}
                keyLinks
              />
            }
            schema={
              <SchemaTabContent
                schema={lexicon.schema()}
                loading={lexicon.loading()}
                error={lexicon.error()}
                fallbackSchema={
                  params.collection === "com.atproto.lexicon.schema"
                    ? (record()?.value as any)
                    : undefined
                }
              />
            }
            backlinks={
              <ErrorBoundary
                fallback={(err) => <div class="wrap-break-word">Error: {err.message}</div>}
              >
                <Suspense fallback={<Spinner class="self-center text-xl" />}>
                  <div class="w-full px-2">
                    <Backlinks target={`at://${did}/${params.collection}/${params.rkey}`} />
                  </div>
                </Suspense>
              </ErrorBoundary>
            }
            info={
              <RecordInfo
                uri={record()!.uri}
                cid={record()?.cid}
                verification={{ valid: validRecord(), error: verifyError() }}
                schema={schemaValidation}
                value={record()!.value}
              />
            }
          />
        </Show>
      </ErrorBoundary>
    </>
  );
};
