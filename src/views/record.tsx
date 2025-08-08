import { CredentialManager, Client } from "@atcute/client";

import { useNavigate, useParams } from "@solidjs/router";
import { createSignal, onMount, Show } from "solid-js";

import { Backlinks } from "../components/backlinks.jsx";
import { JSONValue } from "../components/json.jsx";
import { agent } from "../components/login.jsx";
import { setCID, setValidRecord, setValidSchema, validRecord } from "../components/navbar.jsx";

import { didDocCache, getAllBacklinks, LinkData, resolvePDS } from "../utils/api.js";
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

export const RecordView = () => {
  const navigate = useNavigate();
  const params = useParams();
  const [record, setRecord] =
    createSignal<InferXRPCBodyOutput<ComAtprotoRepoGetRecord.mainSchema["output"]>>();
  const [backlinks, setBacklinks] = createSignal<{ links: LinkData; target: string }>();
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
    setExternalLink(checkUri(res.data.uri));

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
    if (localStorage.backlinks === "true") {
      try {
        const backlinkTarget = `at://${did}/${params.collection}/${params.rkey}`;
        const backlinks = await getAllBacklinks(backlinkTarget);
        setBacklinks({ links: backlinks.links, target: backlinkTarget });
      } catch (e) {
        console.error(e);
      }
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

  const checkUri = (uri: string) => {
    const uriParts = uri.split("/"); // expected: ["at:", "", "repo", "collection", "rkey"]
    if (uriParts.length != 5) return undefined;
    if (uriParts[0] !== "at:" || uriParts[1] !== "") return undefined;
    const parsedUri: AtUri = { repo: uriParts[2], collection: uriParts[3], rkey: uriParts[4] };
    const template = uriTemplates[parsedUri.collection];
    if (!template) return undefined;
    return template(parsedUri);
  };

  return (
    <div class="flex w-full flex-col items-center">
      <Show when={record() === undefined && validRecord() !== false}>
        <div class="i-lucide-loader-circle mt-3 animate-spin text-xl" />
      </Show>
      <Show when={validRecord() === false}>
        <div class="mt-3 break-words text-red-500 dark:text-red-400">{notice()}</div>
      </Show>
      <Show when={record()}>
        <div class="dark:shadow-dark-900/80 dark:bg-dark-300 my-3 flex gap-3 rounded-full bg-white p-2 shadow-sm">
          <Tooltip text="Copy record">
            <button onclick={() => addToClipboard(JSON.stringify(record()?.value))}>
              <div class="i-lucide-copy text-xl" />
            </button>
          </Tooltip>
          <Show when={agent() && agent()?.sub === record()?.uri.split("/")[2]}>
            <RecordEditor create={false} record={record()?.value} />
            <div class="relative flex">
              <Tooltip text="Delete">
                <button onclick={() => setOpenDelete(true)}>
                  <div class="i-lucide-trash-2 text-xl" />
                </button>
              </Tooltip>
              <Modal open={openDelete()} onClose={() => setOpenDelete(false)}>
                <div class="starting:opacity-0 dark:bg-dark-800/70 border-0.5 dark:shadow-dark-900/80 backdrop-blur-xs left-50% top-70 absolute -translate-x-1/2 rounded-md border-neutral-300 bg-zinc-200/70 p-4 text-slate-900 shadow-md transition-opacity duration-300 dark:border-neutral-700 dark:text-slate-100">
                  <h2 class="mb-2 font-bold">Delete this record?</h2>
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      onclick={() => setOpenDelete(false)}
                      class="dark:hover:bg-dark-100 dark:bg-dark-300 dark:shadow-dark-900/80 rounded-lg bg-white px-2 py-1.5 text-sm font-bold shadow-sm hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onclick={deleteRecord}
                      class="dark:shadow-dark-900/80 rounded-lg bg-red-500 px-2 py-1.5 text-sm font-bold text-slate-100 shadow-sm hover:bg-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Modal>
            </div>
          </Show>
          <Show when={externalLink()}>
            {(externalLink) => (
              <Tooltip text={`Open on ${externalLink().label}`}>
                <a target="_blank" href={externalLink()?.link}>
                  <div class={`${externalLink().icon ?? "i-lucide-external-link"} text-xl`} />
                </a>
              </Tooltip>
            )}
          </Show>
          <Show when={backlinks()}>
            <Tooltip text={showBacklinks() ? "Show record" : "Show backlinks"}>
              <button onclick={() => setShowBacklinks(!showBacklinks())}>
                <div
                  class={`${showBacklinks() ? "i-lucide-file-json" : "i-lucide-send-to-back"} text-xl`}
                />
              </button>
            </Tooltip>
          </Show>
        </div>
        <Show when={!showBacklinks()}>
          <div class="break-anywhere w-full whitespace-pre-wrap font-mono text-xs sm:text-sm">
            <JSONValue data={record()?.value as any} repo={record()!.uri.split("/")[2]} />
          </div>
        </Show>
        <Show when={showBacklinks()}>
          <Show when={backlinks()}>
            {(backlinks) => <Backlinks links={backlinks().links} target={backlinks().target} />}
          </Show>
        </Show>
      </Show>
    </div>
  );
};
