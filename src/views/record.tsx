import { Client, CredentialManager } from "@atcute/client";
import { lexiconDoc } from "@atcute/lexicon-doc";
import { ActorIdentifier, is, ResourceUri } from "@atcute/lexicons";
import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createResource, createSignal, ErrorBoundary, Show, Suspense } from "solid-js";
import { Backlinks } from "../components/backlinks.jsx";
import { Button } from "../components/button.jsx";
import { RecordEditor } from "../components/create.jsx";
import { CopyMenu, DropdownMenu, MenuProvider, NavMenu } from "../components/dropdown.jsx";
import { JSONValue } from "../components/json.jsx";
import { agent } from "../components/login.jsx";
import { Modal } from "../components/modal.jsx";
import { pds, setCID, setValidRecord, setValidSchema, validRecord } from "../components/navbar.jsx";
import Tooltip from "../components/tooltip.jsx";
import { setNotif } from "../layout.jsx";
import { didDocCache, resolvePDS } from "../utils/api.js";
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
  const did = params.repo;
  let rpc: Client;

  const fetchRecord = async () => {
    setCID(undefined);
    setValidRecord(undefined);
    setValidSchema(undefined);
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

  return (
    <Show when={record()} keyed>
      <div class="flex w-full flex-col items-center">
        <div class="dark:shadow-dark-800 dark:bg-dark-300 mb-3 flex w-full justify-between rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 px-2 py-1.5 shadow-xs dark:border-neutral-700">
          <div class="flex gap-3 text-sm">
            <A
              classList={{
                "flex items-center gap-1 border-b-2": true,
                "border-transparent hover:border-neutral-400 dark:hover:border-neutral-600":
                  !!location.hash && location.hash !== "#record",
              }}
              href={`/at://${did}/${params.collection}/${params.rkey}#record`}
            >
              <div class="iconify lucide--file-json" />
              Record
            </A>
            <A
              classList={{
                "flex items-center gap-1 border-b-2": true,
                "border-transparent hover:border-neutral-400 dark:hover:border-neutral-600":
                  location.hash !== "#backlinks",
              }}
              href={`/at://${did}/${params.collection}/${params.rkey}#backlinks`}
            >
              <div class="iconify lucide--send-to-back" />
              Backlinks
            </A>
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
          <Show when={validRecord() === false}>
            <div class="mb-2 break-words text-red-500 dark:text-red-400">{notice()}</div>
          </Show>
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
      </div>
    </Show>
  );
};
