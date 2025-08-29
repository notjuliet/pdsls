import { CredentialManager, Client } from "@atcute/client";

import { useNavigate, useParams } from "@solidjs/router";
import { createSignal, ErrorBoundary, onMount, Show, Suspense } from "solid-js";

import { Backlinks } from "../components/backlinks.jsx";
import { JSONValue } from "../components/json.jsx";
import { agent } from "../components/login.jsx";
import { pds, setCID, setValidRecord, setValidSchema, validRecord } from "../components/navbar.jsx";

import { didDocCache, resolvePDS } from "../utils/api.js";
import { AtUri, uriTemplates } from "../utils/templates.js";
import { verifyRecord } from "../utils/verify.js";
import { ActorIdentifier, InferXRPCBodyOutput, is } from "@atcute/lexicons";
import { lexiconDoc } from "@atcute/lexicon-doc";
import { ComAtprotoRepoGetRecord } from "@atcute/atproto";
import { lexicons } from "../utils/types/lexicons.js";
import { RecordEditor } from "../components/create.jsx";
import { addToClipboard } from "../utils/copy.js";
import Tooltip from "../components/tooltip.jsx";
import { Modal } from "../components/modal.jsx";
import { Button } from "../components/button.jsx";

export const RecordView = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [record, setRecord] =
    createSignal<InferXRPCBodyOutput<ComAtprotoRepoGetRecord.mainSchema["output"]>>();
  const [openDelete, setOpenDelete] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [showBacklinks, setShowBacklinks] = createSignal(false);
  const [externalLink, setExternalLink] = createSignal<
    { label: string; link: string; icon?: string } | undefined
  >();
  const did = params.repo;
  let rpc: Client;

  onMount(async () => {
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
    setRecord(res.data);
    setCID(res.data.cid);
    setExternalLink(checkUri(res.data.uri, res.data.value));

    try {
      if (params.collection in lexicons) {
        if (is(lexicons[params.collection], res.data.value)) setValidSchema(true);
        else setValidSchema(false);
      } else if (params.collection === "com.atproto.lexicon.schema") {
        try {
          lexiconDoc.parse(res.data.value, { mode: "passthrough" });
          setValidSchema(true);
        } catch (e) {
          console.error(e);
          setValidSchema(false);
        }
      }
      const { errors } = await verifyRecord({
        rpc: rpc,
        uri: res.data.uri,
        cid: res.data.cid!,
        record: res.data.value,
        didDoc: didDocCache[res.data.uri.split("/")[2]],
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
  });

  const deleteRecord = async () => {
    rpc = new Client({ handler: agent()! });
    await rpc.post("com.atproto.repo.deleteRecord", {
      input: {
        repo: params.repo as ActorIdentifier,
        collection: params.collection as `${string}.${string}.${string}`,
        rkey: params.rkey,
      },
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

  return (
    <div class="flex w-full flex-col items-center">
      <Show when={record() === undefined && validRecord() !== false}>
        <div class="iconify lucide--loader-circle mt-3 animate-spin text-xl" />
      </Show>
      <Show when={validRecord() === false}>
        <div class="mt-3 break-words text-red-500 dark:text-red-400">{notice()}</div>
      </Show>
      <Show when={record()}>
        <div class="dark:shadow-dark-900/80 dark:bg-dark-300 my-3 flex w-[22rem] justify-between rounded-lg bg-white px-2 py-1.5 shadow-sm sm:w-[24rem]">
          <div class="flex gap-3 text-sm">
            <button
              classList={{
                "flex items-center gap-1 border-b-2": true,
                "border-transparent hover:border-neutral-400 dark:hover:border-neutral-600":
                  showBacklinks(),
              }}
              onclick={() => setShowBacklinks(!showBacklinks())}
            >
              <div class="iconify lucide--file-json" />
              Record
            </button>
            <button
              classList={{
                "flex items-center gap-1 border-b-2": true,
                "border-transparent hover:border-neutral-400 dark:hover:border-neutral-600":
                  !showBacklinks(),
              }}
              onclick={() => setShowBacklinks(!showBacklinks())}
            >
              <div class="iconify lucide--send-to-back" />
              Backlinks
            </button>
          </div>
          <div class="flex gap-1">
            <Show when={agent() && agent()?.sub === record()?.uri.split("/")[2]}>
              <RecordEditor create={false} record={record()?.value} />
              <Tooltip text="Delete">
                <button
                  class="flex items-center rounded-sm p-1 hover:bg-neutral-100 active:bg-neutral-100 dark:hover:bg-neutral-600 dark:active:bg-neutral-600"
                  onclick={() => setOpenDelete(true)}
                >
                  <span class="iconify lucide--trash-2"></span>
                </button>
              </Tooltip>
              <Modal open={openDelete()} onClose={() => setOpenDelete(false)}>
                <div class="dark:bg-dark-800/70 dark:shadow-dark-900/80 absolute top-70 left-[50%] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-200/70 p-4 text-neutral-900 shadow-md backdrop-blur-xs transition-opacity duration-300 dark:border-neutral-700 dark:text-neutral-200 starting:opacity-0">
                  <h2 class="mb-2 font-bold">Delete this record?</h2>
                  <div class="flex justify-end gap-2">
                    <Button onClick={() => setOpenDelete(false)}>Cancel</Button>
                    <Button
                      onClick={deleteRecord}
                      class="dark:shadow-dark-900/80 rounded-lg bg-red-500 px-2 py-1.5 text-xs font-semibold text-neutral-200 shadow-sm hover:bg-red-400 active:bg-red-400"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Modal>
            </Show>
            <Tooltip text="Copy record">
              <button
                class="flex items-center rounded-sm p-1 hover:bg-neutral-100 active:bg-neutral-100 dark:hover:bg-neutral-600 dark:active:bg-neutral-600"
                onclick={() => addToClipboard(JSON.stringify(record()?.value, null, 2))}
              >
                <span class="iconify lucide--copy"></span>
              </button>
            </Tooltip>
            <Show when={externalLink()}>
              {(externalLink) => (
                <Tooltip text={`Open on ${externalLink().label}`}>
                  <a
                    class="flex items-center rounded-sm p-1 hover:bg-neutral-100 active:bg-neutral-100 dark:hover:bg-neutral-600 dark:active:bg-neutral-600"
                    target="_blank"
                    href={externalLink()?.link}
                  >
                    <span class={`iconify ${externalLink().icon ?? "lucide--app-window"}`}></span>
                  </a>
                </Tooltip>
              )}
            </Show>
            <Tooltip text="Record on PDS">
              <a
                class="flex items-center rounded-sm p-1 hover:bg-neutral-100 active:bg-neutral-100 dark:hover:bg-neutral-600 dark:active:bg-neutral-600"
                href={`https://${pds()}/xrpc/com.atproto.repo.getRecord?repo=${params.repo}&collection=${params.collection}&rkey=${params.rkey}`}
                target="_blank"
              >
                <span class="iconify lucide--external-link"></span>
              </a>
            </Tooltip>
          </div>
        </div>
        <Show when={!showBacklinks()}>
          <div class="w-full font-mono text-xs wrap-anywhere whitespace-pre-wrap sm:text-sm">
            <JSONValue data={record()?.value as any} repo={record()!.uri.split("/")[2]} />
          </div>
        </Show>
        <Show when={showBacklinks()}>
          <ErrorBoundary fallback={(err) => <div class="break-words">Error: {err.message}</div>}>
            <Suspense
              fallback={
                <div class="iconify lucide--loader-circle animate-spin self-center text-xl" />
              }
            >
              <Backlinks target={`at://${did}/${params.collection}/${params.rkey}`} />
            </Suspense>
          </ErrorBoundary>
        </Show>
      </Show>
    </div>
  );
};
