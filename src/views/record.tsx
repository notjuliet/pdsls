import { CredentialManager, Client } from "@atcute/client";

import { query, useParams } from "@solidjs/router";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";

import { Backlinks } from "../components/backlinks.jsx";
import { JSONValue } from "../components/json.jsx";
import { agent, loginState } from "../components/login.jsx";
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

export const RecordView = () => {
  const params = useParams();
  const [record, setRecord] =
    createSignal<InferXRPCBodyOutput<ComAtprotoRepoGetRecord.mainSchema["output"]>>();
  const [backlinks, setBacklinks] = createSignal<{
    links: LinkData;
    target: string;
  }>();
  const [modal, setModal] = createSignal<HTMLDialogElement>();
  const [openDelete, setOpenDelete] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [showBacklinks, setShowBacklinks] = createSignal(false);
  const [externalLink, setExternalLink] = createSignal<
    { label: string; link: string; icon?: string } | undefined
  >();
  const did = params.repo;
  let rpc: Client;

  const clickEvent = (event: MouseEvent) => {
    if (modal() && event.target == modal()) setOpenDelete(false);
  };
  const keyEvent = (event: KeyboardEvent) => {
    if (modal() && event.key == "Escape") setOpenDelete(false);
  };

  onMount(async () => {
    window.addEventListener("click", clickEvent);
    window.addEventListener("keydown", keyEvent);
    setCID(undefined);
    setValidRecord(undefined);
    setValidSchema(undefined);
    const pds = await resolvePDS(did);
    rpc = new Client({ handler: new CredentialManager({ service: pds }) });
    const res = await getRecord(did, params.collection, params.rkey);
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

  onCleanup(() => {
    window.removeEventListener("click", clickEvent);
    window.removeEventListener("keydown", keyEvent);
  });

  const getRecord = query(
    (repo: string, collection: string, rkey: string) =>
      rpc.get("com.atproto.repo.getRecord", {
        params: {
          repo: repo as ActorIdentifier,
          collection: collection as `${string}.${string}.${string}`,
          rkey: rkey,
        },
      }),
    "getRecord",
  );

  const deleteRecord = async () => {
    rpc = new Client({ handler: agent });
    await rpc.post("com.atproto.repo.deleteRecord", {
      input: {
        repo: params.repo as ActorIdentifier,
        collection: params.collection as `${string}.${string}.${string}`,
        rkey: params.rkey,
      },
    });
    window.location.href = `/at://${params.repo}/${params.collection}`;
  };

  createEffect(() => {
    if (openDelete()) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
  });

  const checkUri = (uri: string) => {
    const uriParts = uri.split("/"); // expected: ["at:", "", "repo", "collection", "rkey"]
    if (uriParts.length != 5) return undefined;
    if (uriParts[0] !== "at:" || uriParts[1] !== "") return undefined;
    const parsedUri: AtUri = {
      repo: uriParts[2],
      collection: uriParts[3],
      rkey: uriParts[4],
    };
    const template = uriTemplates[parsedUri.collection];
    if (!template) return undefined;
    return template(parsedUri);
  };

  return (
    <div class="flex w-full flex-col items-center gap-3">
      <Show when={record() === undefined && validRecord() !== false}>
        <div class="i-eos-icons-loading text-2xl" />
      </Show>
      <Show when={validRecord() === false}>
        <div class="break-words text-red-500 dark:text-red-400">{notice()}</div>
      </Show>
      <Show when={record()}>
        <div class="mt-3 flex gap-3">
          <Tooltip text="Copy record">
            <button
              class="i-lucide-copy text-xl"
              onclick={() => addToClipboard(JSON.stringify(record()?.value))}
            />
          </Tooltip>
          <Show when={loginState() && agent.sub === record()?.uri.split("/")[2]}>
            <RecordEditor create={false} record={record()?.value} />
            <Show when={openDelete()}>
              <dialog
                ref={setModal}
                class="backdrop-brightness-60 fixed left-0 top-0 z-20 flex h-screen w-screen items-center justify-center bg-transparent"
              >
                <div class="dark:bg-dark-400 rounded-md border border-slate-900 bg-zinc-100 p-4 text-slate-900 dark:border-slate-100 dark:text-slate-100">
                  <h3 class="text-lg font-bold">Delete this record?</h3>
                  <form>
                    <div class="mt-2 inline-flex gap-2">
                      <button
                        onclick={() => setOpenDelete(false)}
                        class="dark:bg-dark-900 dark:hover:bg-dark-300 bg-light-100 rounded-lg border border-slate-400 px-2.5 py-1.5 text-sm font-bold hover:bg-zinc-200 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onclick={deleteRecord}
                        class="rounded-lg bg-red-500 px-2.5 py-1.5 text-sm font-bold text-slate-100 hover:bg-red-400 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:bg-red-600 dark:hover:bg-red-500 dark:focus:ring-slate-300"
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                </div>
              </dialog>
            </Show>
            <Tooltip text="Delete">
              <button onclick={() => setOpenDelete(true)} class="i-lucide-trash-2 text-xl" />
            </Tooltip>
          </Show>
          <Show when={externalLink()}>
            {(externalLink) => (
              <Tooltip text={`Open on ${externalLink().label}`}>
                <a
                  class={`${externalLink().icon ?? "i-lucide-external-link"} text-xl`}
                  target="_blank"
                  href={externalLink()?.link}
                ></a>
              </Tooltip>
            )}
          </Show>
          <Show when={backlinks()}>
            <Tooltip text={showBacklinks() ? "Show record" : "Show backlinks"}>
              <button
                classList={{
                  "i-lucide-send-to-back text-xl": !showBacklinks(),
                  "i-lucide-file-json text-xl": showBacklinks(),
                }}
                onclick={() => setShowBacklinks(!showBacklinks())}
              />
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
