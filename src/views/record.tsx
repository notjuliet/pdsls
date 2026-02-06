import { Client, simpleFetchHandler } from "@atcute/client";
import { DidDocument, getPdsEndpoint } from "@atcute/identity";
import { lexiconDoc } from "@atcute/lexicon-doc";
import { RecordValidator } from "@atcute/lexicon-doc/validations";
import { FailedLexiconResolutionError, ResolvedSchema } from "@atcute/lexicon-resolver";
import { ActorIdentifier, is, Nsid } from "@atcute/lexicons";
import { AtprotoDid, Did, isNsid } from "@atcute/lexicons/syntax";
import { verifyRecord } from "@atcute/repo";
import { Title } from "@solidjs/meta";
import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createResource, createSignal, ErrorBoundary, Show, Suspense } from "solid-js";
import { agent } from "../auth/state";
import { Backlinks } from "../components/backlinks.jsx";
import { Button } from "../components/button.jsx";
import { RecordEditor, setPlaceholder } from "../components/create";
import {
  CopyMenu,
  DropdownMenu,
  MenuProvider,
  MenuSeparator,
  NavMenu,
} from "../components/dropdown.jsx";
import { JSONValue } from "../components/json.jsx";
import { LexiconSchemaView } from "../components/lexicon-schema.jsx";
import { Modal } from "../components/modal.jsx";
import { pds } from "../components/navbar.jsx";
import { addNotification, removeNotification } from "../components/notification.jsx";
import { PermissionButton } from "../components/permission-button.jsx";
import {
  didDocumentResolver,
  resolveLexiconAuthority,
  resolveLexiconSchema,
  resolvePDS,
} from "../utils/api.js";
import { clearCollectionCache } from "../utils/route-cache.js";
import { AtUri, uriTemplates } from "../utils/templates.js";
import { lexicons } from "../utils/types/lexicons.js";

const authorityCache = new Map<string, Promise<AtprotoDid>>();
const documentCache = new Map<string, Promise<DidDocument>>();
const schemaCache = new Map<string, Promise<unknown>>();

const getAuthoritySegment = (nsid: string): string => {
  const segments = nsid.split(".");
  return segments.slice(0, -1).join(".");
};

const resolveSchema = async (authority: AtprotoDid, nsid: Nsid): Promise<unknown> => {
  const cacheKey = `${authority}:${nsid}`;

  let cachedSchema = schemaCache.get(cacheKey);
  if (cachedSchema) {
    return cachedSchema;
  }

  const schemaPromise = (async () => {
    let didDocPromise = documentCache.get(authority);
    if (!didDocPromise) {
      didDocPromise = didDocumentResolver().resolve(authority);
      documentCache.set(authority, didDocPromise);
    }

    const didDocument = await didDocPromise;
    const pdsEndpoint = getPdsEndpoint(didDocument);

    if (!pdsEndpoint) {
      throw new FailedLexiconResolutionError(nsid, {
        cause: new TypeError(`no pds service in did document; did=${authority}`),
      });
    }

    const rpc = new Client({ handler: simpleFetchHandler({ service: pdsEndpoint }) });
    const response = await rpc.get("com.atproto.repo.getRecord", {
      params: {
        repo: authority,
        collection: "com.atproto.lexicon.schema",
        rkey: nsid,
      },
    });

    if (!response.ok) {
      throw new Error(`got http ${response.status}`);
    }

    return response.data.value;
  })();

  schemaCache.set(cacheKey, schemaPromise);

  try {
    return await schemaPromise;
  } catch (err) {
    schemaCache.delete(cacheKey);
    throw err;
  }
};

const extractRefs = (obj: any): Nsid[] => {
  const refs: Set<string> = new Set();

  const traverse = (value: any) => {
    if (!value || typeof value !== "object") return;

    if (value.type === "ref" && value.ref) {
      const ref = value.ref;
      if (!ref.startsWith("#")) {
        const nsid = ref.split("#")[0];
        if (isNsid(nsid)) refs.add(nsid);
      }
    }

    if (value.type === "union" && Array.isArray(value.refs)) {
      for (const ref of value.refs) {
        if (!ref.startsWith("#")) {
          const nsid = ref.split("#")[0];
          if (isNsid(nsid)) refs.add(nsid);
        }
      }
    }

    if (Array.isArray(value)) value.forEach(traverse);
    else Object.values(value).forEach(traverse);
  };

  traverse(obj);
  return Array.from(refs) as Nsid[];
};

const resolveAllLexicons = async (
  nsid: Nsid,
  depth: number = 0,
  resolved: Map<string, any> = new Map(),
  failed: Set<string> = new Set(),
  inFlight: Map<string, Promise<void>> = new Map(),
): Promise<{ resolved: Map<string, any>; failed: Set<string> }> => {
  if (depth >= 10) {
    console.warn(`Maximum recursion depth reached for ${nsid}`);
    return { resolved, failed };
  }

  if (resolved.has(nsid) || failed.has(nsid)) return { resolved, failed };

  if (inFlight.has(nsid)) {
    await inFlight.get(nsid);
    return { resolved, failed };
  }

  const fetchPromise = (async () => {
    let authority: AtprotoDid | undefined;
    const authoritySegment = getAuthoritySegment(nsid);
    try {
      let authorityPromise = authorityCache.get(authoritySegment);
      if (!authorityPromise) {
        authorityPromise = resolveLexiconAuthority(nsid);
        authorityCache.set(authoritySegment, authorityPromise);
      }

      authority = await authorityPromise;
      const schema = await resolveSchema(authority, nsid);

      resolved.set(nsid, schema);

      const refs = extractRefs(schema);

      if (refs.length > 0) {
        await Promise.all(
          refs.map((ref) => resolveAllLexicons(ref, depth + 1, resolved, failed, inFlight)),
        );
      }
    } catch (err) {
      console.error(`Failed to resolve lexicon ${nsid}:`, err);
      failed.add(nsid);
      authorityCache.delete(authoritySegment);
      if (authority) {
        documentCache.delete(authority);
      }
    } finally {
      inFlight.delete(nsid);
    }
  })();

  inFlight.set(nsid, fetchPromise);
  await fetchPromise;

  return { resolved, failed };
};

export const RecordView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [openDelete, setOpenDelete] = createSignal(false);
  const [verifyError, setVerifyError] = createSignal("");
  const [validationError, setValidationError] = createSignal("");
  const [externalLink, setExternalLink] = createSignal<
    { label: string; link: string; icon?: string } | undefined
  >();
  const [lexiconAuthority, setLexiconAuthority] = createSignal<AtprotoDid>();
  const [validRecord, setValidRecord] = createSignal<boolean | undefined>(undefined);
  const [validSchema, setValidSchema] = createSignal<boolean | undefined>(undefined);
  const [schema, setSchema] = createSignal<ResolvedSchema>();
  const [lexiconNotFound, setLexiconNotFound] = createSignal<boolean>();
  const [remoteValidation, setRemoteValidation] = createSignal<boolean>();
  const did = params.repo;
  let rpc: Client;

  const fetchRecord = async () => {
    setValidRecord(undefined);
    setValidSchema(undefined);
    const pds = await resolvePDS(did!);
    rpc = new Client({ handler: simpleFetchHandler({ service: pds }) });
    const res = await rpc.get("com.atproto.repo.getRecord", {
      params: {
        repo: did as ActorIdentifier,
        collection: params.collection as `${string}.${string}.${string}`,
        rkey: params.rkey!,
      },
    });
    if (!res.ok) {
      setValidRecord(false);
      setVerifyError(res.data.error);
      throw new Error(res.data.error);
    }
    setPlaceholder(res.data.value);
    setExternalLink(checkUri(res.data.uri, res.data.value));
    resolveLexicon(params.collection as Nsid);
    verifyRecordIntegrity();
    validateLocalSchema(res.data.value);

    return res.data;
  };

  const [record, { refetch }] = createResource(fetchRecord);

  const validateLocalSchema = async (record: Record<string, unknown>) => {
    try {
      if (params.collection === "com.atproto.lexicon.schema") {
        setLexiconNotFound(false);
        lexiconDoc.parse(record, { mode: "passthrough" });
        setValidSchema(true);
      } else if (params.collection && params.collection in lexicons) {
        if (is(lexicons[params.collection], record)) setValidSchema(true);
        else setValidSchema(false);
      }
    } catch (err: any) {
      console.error("Schema validation error:", err);
      setValidSchema(false);
      setValidationError(err.message || String(err));
    }
  };

  const validateRemoteSchema = async (record: Record<string, unknown>) => {
    try {
      setRemoteValidation(true);
      const { resolved, failed } = await resolveAllLexicons(params.collection as Nsid);

      if (failed.size > 0) {
        console.error(`Failed to resolve ${failed.size} documents:`, Array.from(failed));
        setValidSchema(false);
        setValidationError(`Unable to resolve lexicon documents: ${Array.from(failed).join(", ")}`);
        return;
      }

      const lexiconDocs = Object.fromEntries(resolved);

      const validator = new RecordValidator(lexiconDocs, params.collection as Nsid);
      validator.parse({
        key: params.rkey ?? null,
        object: record,
      });

      setValidSchema(true);
    } catch (err: any) {
      console.error("Schema validation error:", err);
      setValidSchema(false);
      setValidationError(err.message || String(err));
    }
    setRemoteValidation(false);
  };

  const verifyRecordIntegrity = async () => {
    try {
      const { ok, data } = await rpc.get("com.atproto.sync.getRecord", {
        params: {
          did: did as Did,
          collection: params.collection as Nsid,
          rkey: params.rkey!,
        },
        as: "bytes",
      });
      if (!ok) throw data.error;

      await verifyRecord({
        did: did as AtprotoDid,
        collection: params.collection!,
        rkey: params.rkey!,
        carBytes: data as Uint8Array<ArrayBufferLike>,
      });

      setValidRecord(true);
    } catch (err: any) {
      console.error("Record verification error:", err);
      setVerifyError(err.message);
      setValidRecord(false);
    }
  };

  const resolveLexicon = async (nsid: Nsid) => {
    try {
      const authority = await resolveLexiconAuthority(nsid);
      setLexiconAuthority(authority);
      if (params.collection !== "com.atproto.lexicon.schema") {
        const schema = await resolveLexiconSchema(authority, nsid);
        setSchema(schema);
        setLexiconNotFound(false);
      }
    } catch {
      setLexiconNotFound(true);
    }
  };

  const deleteRecord = async () => {
    rpc = new Client({ handler: agent()! });
    await rpc.post("com.atproto.repo.deleteRecord", {
      input: {
        repo: params.repo as ActorIdentifier,
        collection: params.collection as `${string}.${string}.${string}`,
        rkey: params.rkey!,
      },
    });
    const id = addNotification({
      message: "Record deleted",
      type: "success",
    });
    setTimeout(() => removeNotification(id), 3000);
    clearCollectionCache(`${params.pds}/${params.repo}/${params.collection}`);
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
      if (!location.hash && props.tab === "record") return true;
      if (location.hash === `#${props.tab}`) return true;
      if (props.tab === "schema" && location.hash.startsWith("#schema:")) return true;
      return false;
    };

    return (
      <div class="flex items-center gap-0.5">
        <A
          classList={{
            "border-b-2 font-medium transition-colors": true,
            "border-transparent text-neutral-600 dark:text-neutral-300/80 hover:text-neutral-900 dark:hover:text-neutral-100":
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

  return (
    <>
      <Title>
        {params.collection}/{params.rkey} - PDSls
      </Title>
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
              <div class="flex items-center gap-4">
                <RecordTab tab="record" label="Record" />
                <RecordTab tab="schema" label="Schema" />
                <RecordTab tab="backlinks" label="Backlinks" />
                <RecordTab tab="info" label="Info" error />
              </div>
              <div class="flex gap-0.5">
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
                <MenuProvider>
                  <DropdownMenu icon="lucide--ellipsis" buttonClass="rounded-sm p-1.5">
                    <CopyMenu
                      content={JSON.stringify(record()?.value, null, 2)}
                      label="Copy record"
                      icon="lucide--copy"
                    />
                    <CopyMenu
                      content={`at://${params.repo}/${params.collection}/${params.rkey}`}
                      label="Copy AT URI"
                      icon="lucide--copy"
                    />
                    <Show when={record()?.cid}>
                      {(cid) => <CopyMenu content={cid()} label="Copy CID" icon="lucide--copy" />}
                    </Show>
                    <MenuSeparator />
                    <Show when={externalLink()}>
                      {(externalLink) => (
                        <NavMenu
                          href={externalLink()?.link}
                          icon={`${externalLink().icon ?? "lucide--app-window"}`}
                          label={`Open on ${externalLink().label}`}
                          newTab
                        />
                      )}
                    </Show>
                    <NavMenu
                      href={`https://${pds()}/xrpc/com.atproto.repo.getRecord?repo=${params.repo}&collection=${params.collection}&rkey=${params.rkey}`}
                      icon="lucide--external-link"
                      label="Record on PDS"
                      newTab
                    />
                  </DropdownMenu>
                </MenuProvider>
              </div>
            </div>
            <Show when={!location.hash || location.hash === "#record"}>
              <div class="w-full max-w-screen min-w-full px-2 font-mono text-xs wrap-anywhere whitespace-pre-wrap sm:w-max sm:text-sm md:max-w-3xl">
                <JSONValue data={record()?.value as any} repo={record()!.uri.split("/")[2]} />
              </div>
            </Show>
            <Show when={location.hash === "#schema" || location.hash.startsWith("#schema:")}>
              <Show when={lexiconNotFound() === true}>
                <span class="w-full px-2 text-sm">Lexicon schema could not be resolved.</span>
              </Show>
              <Show when={lexiconNotFound() === undefined}>
                <span class="w-full px-2 text-sm">Resolving lexicon schema...</span>
              </Show>
              <Show when={schema() || params.collection === "com.atproto.lexicon.schema"}>
                <ErrorBoundary fallback={(err) => <div>Error: {err.message}</div>}>
                  <LexiconSchemaView
                    schema={schema()?.rawSchema ?? (record()?.value as any)}
                    authority={lexiconAuthority()}
                  />
                </ErrorBoundary>
              </Show>
            </Show>
            <Show when={location.hash === "#backlinks"}>
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
                <div>
                  <p class="font-semibold">AT URI</p>
                  <div class="truncate text-xs text-neutral-700 dark:text-neutral-300">
                    {record()?.uri}
                  </div>
                </div>
                <Show when={record()?.cid}>
                  <div>
                    <p class="font-semibold">CID</p>
                    <div
                      class="truncate text-left text-xs text-neutral-700 dark:text-neutral-300"
                      dir="rtl"
                    >
                      {record()?.cid}
                    </div>
                  </div>
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
                <div>
                  <div class="flex items-center gap-1">
                    <p class="font-semibold">Schema validation</p>
                    <span
                      classList={{
                        "iconify lucide--check text-green-500 dark:text-green-400":
                          validSchema() === true,
                        "iconify lucide--x text-red-500 dark:text-red-400": validSchema() === false,
                        "iconify lucide--loader-circle animate-spin":
                          validSchema() === undefined && remoteValidation(),
                      }}
                    ></span>
                  </div>
                  <Show when={validSchema() === false}>
                    <div class="text-xs wrap-break-word">{validationError()}</div>
                  </Show>
                  <Show
                    when={
                      !remoteValidation() &&
                      validSchema() === undefined &&
                      params.collection &&
                      !(params.collection in lexicons)
                    }
                  >
                    <Button onClick={() => validateRemoteSchema(record()!.value)}>
                      Validate via resolution
                    </Button>
                  </Show>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </ErrorBoundary>
    </>
  );
};
