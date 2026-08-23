import { Client } from "@atcute/client";
import { ActorIdentifier, Nsid } from "@atcute/lexicons";
import { AtprotoDid, Did } from "@atcute/lexicons/syntax";
import { verifyRecord } from "@atcute/repo";
import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createResource, createSignal, ErrorBoundary, For, Show, Suspense } from "solid-js";

import { agent } from "../auth/state";
import { Backlinks } from "../components/backlinks.jsx";
import { Button } from "../components/button.jsx";
import { CopyableInfoField } from "../components/copyable-info-field.jsx";
import { RecordEditor, setPlaceholder } from "../components/create";
import {
  ActionMenu,
  CopyMenu,
  DropdownMenu,
  MenuProvider,
  NavMenu,
} from "../components/dropdown.jsx";
import { Favicon } from "../components/favicon.jsx";
import { JSONValue } from "../components/json.jsx";
import { Modal } from "../components/modal.jsx";
import { addNotification, removeNotification } from "../components/notification.jsx";
import { PermissionButton } from "../components/permission-button.jsx";
import { RecordSchemaValidation } from "../components/record-schema-validation.jsx";
import {
  hasKnownRecordSchema,
  validateKnownRecordSchema,
  validateResolvedRecordSchema,
} from "../lib/record-validation.js";
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
  const [validationError, setValidationError] = createSignal("");
  const [externalLink, setExternalLink] = createSignal<
    { label: string; link: string; icon?: string } | undefined
  >();
  const [validRecord, setValidRecord] = createSignal<boolean | undefined>(undefined);
  const [validSchema, setValidSchema] = createSignal<boolean | undefined>(undefined);
  const [remoteValidation, setRemoteValidation] = createSignal<boolean>();
  const lexicon = useLexiconSchema(() => params.collection);
  const did = repo.did();

  const fetchRecord = async () => {
    const rpc = repo.rpc()!;
    const collection = params.collection!;
    const rkey = params.rkey!;
    setValidRecord(undefined);
    setValidSchema(undefined);
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
    validateLocalSchema(collection, res.data.value);

    return res.data;
  };

  const [record, { refetch }] = createResource(
    () => (repo.rpc() ? params.rkey : undefined),
    fetchRecord,
  );

  const validateLocalSchema = (collection: string, value: unknown) => {
    const result = validateKnownRecordSchema(collection, value);
    if (!result) return;

    setValidSchema(result.valid);
    setValidationError(result.error ?? "");
  };

  const validateRemoteSchema = async (value: unknown) => {
    try {
      setRemoteValidation(true);
      setValidationError("");
      await validateResolvedRecordSchema(params.collection!, params.rkey!, value);
      setValidSchema(true);
    } catch (err) {
      console.error("Schema validation error:", err);
      setValidSchema(false);
      setValidationError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemoteValidation(false);
    }
  };

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
    const id = addNotification({
      message: "Record deleted",
      type: "success",
    });
    setTimeout(() => removeNotification(id), 3000);
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

  const RecordTab = (props: {
    tab: "record" | "backlinks" | "info" | "schema";
    label: string;
    error?: boolean;
  }) => {
    const isActive = () => {
      if (props.tab === "record") return !location.hash || location.hash.startsWith("#record");
      if (location.hash === `#${props.tab}`) return true;
      if (props.tab === "schema" && location.hash.startsWith("#schema:")) return true;
      if (props.tab === "backlinks" && location.hash.startsWith("#backlinks:")) return true;
      return false;
    };

    return (
      <div class="flex items-center gap-0.5">
        <A
          classList={{
            "border-b-2 font-medium transition-colors": true,
            "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
              !isActive(),
          }}
          href={`/at://${did}/${params.collection}/${params.rkey}#${props.tab}`}
        >
          {props.label}
        </A>
        <Show when={props.error && (validRecord() === false || validSchema() === false)}>
          <span class="iconify lucide--x text-red-500 dark:text-red-400"></span>
        </Show>
      </div>
    );
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
          <div class="flex w-full flex-col items-center">
            <div class="mb-3 flex w-full justify-between px-2 text-sm sm:text-base">
              <div class="flex items-center gap-3 sm:gap-4">
                <RecordTab tab="record" label="Record" />
                <RecordTab tab="schema" label="Schema" />
                <RecordTab tab="backlinks" label="Backlinks" />
                <RecordTab tab="info" label="Info" error />
              </div>
              <div class="flex sm:gap-0.5">
                <Show when={agent() && agent()?.sub === record()?.uri.split("/")[2]}>
                  <RecordEditor
                    create={false}
                    record={record()?.value}
                    refetch={refetch}
                    scope="update"
                  />
                  <PermissionButton
                    scope="delete"
                    tooltip="Delete"
                    onClick={() => setOpenDelete(true)}
                  >
                    <span class="iconify lucide--trash-2"></span>
                  </PermissionButton>
                  <Modal
                    open={openDelete()}
                    onClose={() => setOpenDelete(false)}
                    contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
                  >
                    <h2 class="mb-2 font-semibold">Delete this record?</h2>
                    <div class="flex justify-end gap-2">
                      <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
                      <Button
                        onClick={deleteRecord}
                        classList={{
                          "bg-red-500! border-none! text-white! hover:bg-red-400! active:bg-red-400!": true,
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </Modal>
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
              </div>
            </div>
            <Show when={!location.hash || location.hash.startsWith("#record")}>
              <div class="w-full max-w-screen min-w-full px-2 font-mono text-xs wrap-anywhere whitespace-pre-wrap sm:w-max sm:text-sm md:max-w-3xl">
                <JSONValue
                  data={record()?.value as any}
                  repo={record()!.uri.split("/")[2]}
                  pds={repo.pds()}
                  keyLinks
                />
              </div>
            </Show>
            <Show when={lexicon.showSchema()}>
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
            </Show>
            <Show when={location.hash === "#backlinks" || location.hash.startsWith("#backlinks:")}>
              <ErrorBoundary
                fallback={(err) => <div class="wrap-break-word">Error: {err.message}</div>}
              >
                <Suspense
                  fallback={
                    <div class="iconify lucide--loader-circle animate-spin self-center text-xl" />
                  }
                >
                  <div class="w-full px-2">
                    <Backlinks target={`at://${did}/${params.collection}/${params.rkey}`} />
                  </div>
                </Suspense>
              </ErrorBoundary>
            </Show>
            <Show when={location.hash === "#info"}>
              <div class="flex w-full flex-col gap-3 px-2">
                <CopyableInfoField label="AT URI" value={record()!.uri} />
                <Show when={record()?.cid}>
                  {(cid) => <CopyableInfoField label="CID" value={cid()} />}
                </Show>
                <div>
                  <div class="flex items-center gap-1">
                    <p class="font-semibold">Record verification</p>
                    <span
                      classList={{
                        "iconify lucide--check text-green-500 dark:text-green-400":
                          validRecord() === true,
                        "iconify lucide--x text-red-500 dark:text-red-400": validRecord() === false,
                        "iconify lucide--loader-circle animate-spin": validRecord() === undefined,
                      }}
                    ></span>
                  </div>
                  <Show when={validRecord() === false}>
                    <div class="text-xs wrap-break-word">{verifyError()}</div>
                  </Show>
                </div>
                <RecordSchemaValidation
                  valid={validSchema()}
                  error={validationError()}
                  resolving={!!remoteValidation()}
                  canResolve={!!params.collection && !hasKnownRecordSchema(params.collection)}
                  onResolve={() => void validateRemoteSchema(record()!.value)}
                />
              </div>
            </Show>
          </div>
        </Show>
      </ErrorBoundary>
    </>
  );
};
