import { CredentialManager, Client } from "@atcute/client";

import { query, useParams } from "@solidjs/router";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";

import { editor } from "monaco-editor";

import { Backlinks } from "../components/backlinks.jsx";
import { Editor } from "../components/editor.jsx";
import { JSONValue } from "../components/json.jsx";
import { agent, loginState } from "../components/login.jsx";
import { setCID, setValidRecord, validRecord } from "../components/navbar.jsx";
import { theme } from "../components/settings.jsx";

import { didDocCache, getAllBacklinks, LinkData, resolvePDS } from "../utils/api.js";
import { AtUri, uriTemplates } from "../utils/templates.js";
import { verifyRecord } from "../utils/verify.js";
import { ActorIdentifier, InferXRPCBodyOutput } from "@atcute/lexicons";
import { ComAtprotoRepoGetRecord } from "@atcute/atproto";

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
  const [openEdit, setOpenEdit] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [editNotice, setEditNotice] = createSignal("");
  const [externalLink, setExternalLink] = createSignal<
    { label: string; link: string } | undefined
  >();
  let model: editor.IModel;
  const did = params.repo;
  let rpc: Client;
  let formRef!: HTMLFormElement;

  const clickEvent = (event: MouseEvent) => {
    if (modal() && event.target == modal()) setOpenDelete(false);
  };
  const keyEvent = (event: KeyboardEvent) => {
    if (modal() && event.key == "Escape") {
      setOpenDelete(false);
      setOpenEdit(false);
    }
  };

  onMount(async () => {
    window.addEventListener("click", clickEvent);
    window.addEventListener("keydown", keyEvent);
    setCID(undefined);
    setValidRecord(undefined);
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

  const editRecord = async (formData: FormData) => {
    const record = model.getValue();
    const validate =
      formData.get("validate")?.toString() === "true" ? true
      : formData.get("validate")?.toString() === "false" ? false
      : undefined;
    if (!record) return;
    rpc = new Client({ handler: agent });
    try {
      const editedRecord = JSON.parse(record.toString());
      if (formData.get("recreate")) {
        await rpc.post("com.atproto.repo.applyWrites", {
          input: {
            repo: params.repo as ActorIdentifier,
            validate: validate,
            writes: [
              {
                collection: params.collection as `${string}.${string}.${string}`,
                rkey: params.rkey,
                $type: "com.atproto.repo.applyWrites#delete",
              },
              {
                collection: params.collection as `${string}.${string}.${string}`,
                rkey: params.rkey,
                $type: "com.atproto.repo.applyWrites#create",
                value: editedRecord,
              },
            ],
          },
        });
      } else {
        await rpc.post("com.atproto.repo.putRecord", {
          input: {
            repo: params.repo as ActorIdentifier,
            collection: params.collection as `${string}.${string}.${string}`,
            rkey: params.rkey,
            record: editedRecord,
            validate: validate,
          },
        });
      }
      setOpenEdit(false);
      window.location.reload();
    } catch (err: any) {
      setEditNotice(err.message);
    }
  };

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
    if (openDelete() || openEdit()) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    setEditNotice("");
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
    <>
      <Show when={record() === undefined && validRecord() !== false}>
        <div class="i-line-md-loading-twotone-loop mt-3 text-xl" />
      </Show>
      <Show when={validRecord() === false}>
        <div class="w-20rem mb-2 mt-3 break-words text-red-500 dark:text-red-400">{notice()}</div>
      </Show>
      <Show when={record()}>
        <div class="my-3 flex w-full justify-center gap-x-1">
          <Show when={externalLink()}>
            <a
              class="dark:bg-dark-700 dark:hover:bg-dark-300 block flex items-center gap-x-1 rounded-lg border border-slate-400 bg-white px-2 py-1.5 text-xs font-bold hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
              target="_blank"
              href={externalLink()?.link}
            >
              {externalLink()?.label} <div class="i-lucide-external-link text-[0.65rem]" />
            </a>
          </Show>
          <button
            class="dark:bg-dark-700 dark:hover:bg-dark-300 rounded-lg border border-slate-400 bg-white px-2 py-1.5 text-xs font-bold hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
            onclick={() => navigator.clipboard.writeText(JSON.stringify(record()?.value))}
          >
            Copy
          </button>
          <Show when={loginState() && agent.sub === record()?.uri.split("/")[2]}>
            <Show when={openEdit()}>
              <dialog
                ref={setModal}
                class="backdrop-brightness-60 fixed left-0 top-0 z-20 flex h-screen w-screen items-center justify-center bg-transparent"
              >
                <div class="dark:bg-dark-400 rounded-md border border-slate-900 bg-slate-100 p-4 text-slate-900 dark:border-slate-100 dark:text-slate-100">
                  <h3 class="mb-2 text-lg font-bold">Editing record</h3>
                  <form ref={formRef}>
                    <div class="mb-2 flex items-center gap-x-2">
                      <label for="validate" class="min-w-20 select-none">
                        Validate
                      </label>
                      <select
                        name="validate"
                        id="validate"
                        class="dark:bg-dark-100 rounded-lg border border-gray-400 px-1 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
                      >
                        <option value="unset">Unset</option>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    </div>
                    <Editor theme={theme().color} model={model!} />
                    <div class="mt-2 flex flex-col gap-2">
                      <div class="text-red-500 dark:text-red-400">{editNotice()}</div>
                      <div class="flex items-center justify-end gap-2">
                        <div class="flex items-center gap-1">
                          <input id="recreate" class="size-4" name="recreate" type="checkbox" />
                          <label for="recreate" class="select-none">
                            Recreate record
                          </label>
                        </div>
                        <button
                          onclick={() => setOpenEdit(false)}
                          class="dark:bg-dark-900 dark:hover:bg-dark-300 rounded-lg border border-slate-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onclick={() => editRecord(new FormData(formRef))}
                          class="rounded-lg bg-green-500 px-2.5 py-1.5 text-sm font-bold text-slate-100 hover:bg-green-400 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:bg-green-600 dark:hover:bg-green-500 dark:focus:ring-slate-300"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </dialog>
            </Show>
            <button
              onclick={() => {
                model = editor.createModel(JSON.stringify(record()?.value, null, 2), "json");
                setOpenEdit(true);
              }}
              class="dark:bg-dark-700 dark:hover:bg-dark-300 rounded-lg border border-slate-400 bg-white px-2 py-1.5 text-xs font-bold hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
            >
              Edit
            </button>
            <Show when={openDelete()}>
              <dialog
                ref={setModal}
                class="backdrop-brightness-60 fixed left-0 top-0 z-20 flex h-screen w-screen items-center justify-center bg-transparent"
              >
                <div class="dark:bg-dark-400 rounded-md border border-slate-900 bg-slate-100 p-4 text-slate-900 dark:border-slate-100 dark:text-slate-100">
                  <h3 class="text-lg font-bold">Delete this record?</h3>
                  <form>
                    <div class="mt-2 inline-flex gap-2">
                      <button
                        onclick={() => setOpenDelete(false)}
                        class="dark:bg-dark-900 dark:hover:bg-dark-300 rounded-lg border border-slate-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
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
            <button
              onclick={() => setOpenDelete(true)}
              class="dark:bg-dark-700 dark:hover:bg-dark-300 rounded-lg border border-red-500 bg-white px-2 py-1.5 text-xs font-bold text-red-500 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-red-400 dark:border-red-400 dark:text-red-400"
            >
              Delete
            </button>
          </Show>
        </div>
        <div class="break-anywhere mb-3 whitespace-pre-wrap font-mono text-xs sm:text-sm">
          <JSONValue data={record()?.value as any} repo={record()!.uri.split("/")[2]} />
        </div>
        <Show when={backlinks()}>
          {(backlinks) => <Backlinks links={backlinks().links} target={backlinks().target} />}
        </Show>
      </Show>
    </>
  );
};
