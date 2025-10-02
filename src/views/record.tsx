import { Client, CredentialManager } from "@atcute/client";
import { lexiconDoc } from "@atcute/lexicon-doc";
import { ActorIdentifier, is, Nsid, ResourceUri } from "@atcute/lexicons";
import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createResource, createSignal, ErrorBoundary, Show, Suspense } from "solid-js";
import { Backlinks } from "../components/backlinks.jsx";
import { Button } from "../components/button.jsx";
import { RecordEditor } from "../components/create.jsx";
import { CopyMenu, DropdownMenu, MenuProvider, NavMenu } from "../components/dropdown.jsx";
import { JSONValue } from "../components/json.jsx";
import { agent } from "../components/login.jsx";
import { Modal } from "../components/modal.jsx";
import { pds, setCID } from "../components/navbar.jsx";
import Tooltip from "../components/tooltip.jsx";
import { setNotif } from "../layout.jsx";
import { didDocCache, resolveLexiconAuthority, resolvePDS } from "../utils/api.js";
import { AtUri, uriTemplates } from "../utils/templates.js";
import { lexicons } from "../utils/types/lexicons.js";
import { verifyRecord } from "../utils/verify.js";

export const RecordView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [openDelete, setOpenDelete] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [externalLink, setExternalLink] = createSignal<
    { label: string; link: string; icon?: string } | undefined
  >();
  const [lexiconUri, setLexiconUri] = createSignal<string>();
  const [validRecord, setValidRecord] = createSignal<boolean | undefined>(undefined);
  const [validSchema, setValidSchema] = createSignal<boolean | undefined>(undefined);
  const did = params.repo;
  let rpc: Client;

  const fetchRecord = async () => {
    setCID(undefined);
    setValidRecord(undefined);
    setValidSchema(undefined);
    setLexiconUri(undefined);
    const pds = await resolvePDS(did);
    rpc = new Client({ handler: new CredentialManager({ service: pds }) });
    const res = await rpc.get("com.atproto.repo.getRecord", {
      params: {
        repo: did as ActorIdentifier,
        collection: params.collection as `${string}.${string}.${string}`,
        rkey: params.rkey,
      },
    });
    if (!res.ok) {
      setValidRecord(false);
      setNotice(res.data.error);
      throw new Error(res.data.error);
    }
    setCID(res.data.cid);
    setExternalLink(checkUri(res.data.uri, res.data.value));
    resolveLexicon(params.collection as Nsid);
    verify(res.data);

    return res.data;
  };

  const verify = async (record: {
    uri: ResourceUri;
    value: Record<string, unknown>;
    cid?: string | undefined;
  }) => {
    try {
      if (params.collection in lexicons) {
        if (is(lexicons[params.collection], record.value)) setValidSchema(true);
        else setValidSchema(false);
      } else if (params.collection === "com.atproto.lexicon.schema") {
        try {
          lexiconDoc.parse(record.value, { mode: "passthrough" });
          setValidSchema(true);
        } catch (e) {
          console.error(e);
          setValidSchema(false);
        }
      }
      const { errors } = await verifyRecord({
        rpc: rpc,
        uri: record.uri,
        cid: record.cid!,
        record: record.value,
        didDoc: didDocCache[record.uri.split("/")[2]],
      });

      if (errors.length > 0) {
        console.warn(errors);
        setNotice(`Invalid record: ${errors.map((e) => e.message).join("\n")}`);
      }
      setValidRecord(errors.length === 0);
    } catch (err) {
      console.error(err);
      setValidRecord(false);
    }
  };

  const resolveLexicon = async (nsid: Nsid) => {
    try {
      const res = await resolveLexiconAuthority(nsid);
      setLexiconUri(`at://${res}/com.atproto.lexicon.schema/${nsid}`);
    } catch {}
  };

  const [record, { refetch }] = createResource(fetchRecord);

  const deleteRecord = async () => {
    rpc = new Client({ handler: agent()! });
    await rpc.post("com.atproto.repo.deleteRecord", {
      input: {
        repo: params.repo as ActorIdentifier,
        collection: params.collection as `${string}.${string}.${string}`,
        rkey: params.rkey,
      },
    });
    setNotif({ show: true, icon: "lucide--trash-2", text: "Record deleted" });
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

  const RecordTab = (props: { tab: "record" | "backlinks" | "info"; label: string }) => (
    <A
      classList={{
        "flex items-center gap-1 border-b-2": true,
        "border-transparent hover:border-neutral-400 dark:hover:border-neutral-600":
          (!!location.hash && location.hash !== `#${props.tab}`) ||
          (!location.hash && props.tab !== "record"),
      }}
      href={`/at://${did}/${params.collection}/${params.rkey}#${props.tab}`}
    >
      {props.label}
    </A>
  );

  return (
    <Show when={record()} keyed>
      <div class="flex w-full flex-col items-center">
        <div class="dark:shadow-dark-800 dark:bg-dark-300 mb-3 flex w-full justify-between rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 px-2 py-1.5 text-sm shadow-xs dark:border-neutral-700">
          <div class="flex gap-3">
            <RecordTab tab="record" label="Record" />
            <RecordTab tab="backlinks" label="Backlinks" />
            <RecordTab tab="info" label="Info" />
          </div>
          <div class="flex gap-1">
            <Show when={agent() && agent()?.sub === record()?.uri.split("/")[2]}>
              <RecordEditor create={false} record={record()?.value} refetch={refetch} />
              <Tooltip text="Delete">
                <button
                  class="flex items-center rounded-sm p-1 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                  onclick={() => setOpenDelete(true)}
                >
                  <span class="iconify lucide--trash-2"></span>
                </button>
              </Tooltip>
              <Modal open={openDelete()} onClose={() => setOpenDelete(false)}>
                <div class="dark:bg-dark-300 dark:shadow-dark-800 absolute top-70 left-[50%] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 dark:border-neutral-700 starting:opacity-0">
                  <h2 class="mb-2 font-semibold">Delete this record?</h2>
                  <div class="flex justify-end gap-2">
                    <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
                    <Button
                      onClick={deleteRecord}
                      class="dark:shadow-dark-800 rounded-lg bg-red-500 px-2 py-1.5 text-xs font-semibold text-neutral-200 shadow-xs select-none hover:bg-red-400 active:bg-red-400"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Modal>
            </Show>
            <MenuProvider>
              <DropdownMenu
                icon="lucide--ellipsis-vertical "
                buttonClass="rounded-sm p-1"
                menuClass="top-8 p-2 text-sm"
              >
                <CopyMenu
                  copyContent={JSON.stringify(record()?.value, null, 2)}
                  label="Copy record"
                  icon="lucide--copy"
                />
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
          <div class="w-max max-w-screen min-w-full px-4 font-mono text-xs wrap-anywhere whitespace-pre-wrap sm:px-2 sm:text-sm md:max-w-[48rem]">
            <JSONValue data={record()?.value as any} repo={record()!.uri.split("/")[2]} />
          </div>
        </Show>
        <Show when={location.hash === "#backlinks"}>
          <ErrorBoundary fallback={(err) => <div class="break-words">Error: {err.message}</div>}>
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
          <div class="flex w-full flex-col gap-2 px-2 text-sm">
            <div>
              <div class="flex items-center gap-1">
                <span class="iconify lucide--at-sign"></span>
                <p class="font-semibold">AT URI</p>
              </div>
              <div class="truncate text-xs">{record()?.uri}</div>
            </div>
            <Show when={record()?.cid}>
              <div>
                <div class="flex items-center gap-1">
                  <span class="iconify lucide--box"></span>
                  <p class="font-semibold">CID</p>
                </div>
                <div class="truncate text-left text-xs" dir="rtl">
                  {record()?.cid}
                </div>
              </div>
            </Show>
            <div>
              <div class="flex items-center gap-1">
                <span class="iconify lucide--lock-keyhole"></span>
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
                <div class="break-words">{notice()}</div>
              </Show>
            </div>
            <Show when={validSchema() !== undefined}>
              <div class="flex items-center gap-1">
                <span class="iconify lucide--file-check"></span>
                <p class="font-semibold">Schema validation</p>
                <span
                  class={`iconify ${validSchema() ? "lucide--check text-green-500 dark:text-green-400" : "lucide--x text-red-500 dark:text-red-400"}`}
                ></span>
              </div>
            </Show>
            <Show when={lexiconUri()}>
              <div>
                <div class="flex items-center gap-1">
                  <span class="iconify lucide--scroll-text"></span>
                  <p class="font-semibold">Lexicon document</p>
                </div>
                <div class="truncate text-xs">
                  <A
                    href={`/${lexiconUri()}`}
                    class="text-blue-400 hover:underline active:underline"
                  >
                    {lexiconUri()}
                  </A>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
};
