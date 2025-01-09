import { createSignal, onMount, Show, onCleanup, createEffect } from "solid-js";
import { CredentialManager, XRPC } from "@atcute/client";
import { ComAtprotoRepoGetRecord } from "@atcute/client/lexicons";
import { action, query, redirect, useParams } from "@solidjs/router";
import { JSONValue } from "../components/json.jsx";
import { authenticate_post_with_doc } from "public-transport";
import { agent, loginState } from "../views/login.jsx";
import { Editor } from "../components/editor.jsx";
import { editor } from "monaco-editor";
import { setValidRecord, theme, validRecord } from "../main.jsx";
import { didDocCache, resolveHandle, resolvePDS } from "../utils/api.js";

const RecordView = () => {
  const params = useParams();
  const [record, setRecord] = createSignal<ComAtprotoRepoGetRecord.Output>();
  const [modal, setModal] = createSignal<HTMLDialogElement>();
  const [openDelete, setOpenDelete] = createSignal(false);
  const [openEdit, setOpenEdit] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [editNotice, setEditNotice] = createSignal("");
  const [JSONSyntax, setJSONSyntax] = createSignal(false);
  const [externalLink, setExternalLink] = createSignal<
    { label: string; link: string } | undefined
  >();
  let model: editor.IModel;
  let rpc: XRPC;

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
    setValidRecord(undefined);
    const did =
      params.repo.startsWith("did:") ?
        params.repo
      : await resolveHandle(params.repo);
    const pds = await resolvePDS(did);
    rpc = new XRPC({ handler: new CredentialManager({ service: pds }) });
    try {
      const res = await getRecord(did, params.collection, params.rkey);
      setRecord(res.data);
      setExternalLink(checkUri(res.data.uri));
      await authenticate_post_with_doc(
        res.data.uri,
        res.data.cid!,
        res.data.value,
        didDocCache[res.data.uri.split("/")[2]],
      );
      setValidRecord(true);
    } catch (err: any) {
      if (err.message) setNotice(err.message);
      else setNotice(`Invalid record: ${err}`);
      setValidRecord(false);
    }
  });

  onCleanup(() => {
    window.removeEventListener("click", clickEvent);
    window.removeEventListener("keydown", keyEvent);
  });

  const getRecord = query(
    (repo: string, collection: string, rkey: string) =>
      rpc.get("com.atproto.repo.getRecord", {
        params: { repo: repo, collection: collection, rkey: rkey },
      }),
    "getRecord",
  );

  const editRecord = action(async (formData: FormData) => {
    const record = model.getValue();
    const validate =
      formData.get("validate")?.toString() === "true" ? true
      : formData.get("validate")?.toString() === "false" ? false
      : undefined;
    if (!record) return;
    rpc = new XRPC({ handler: agent });
    try {
      const editedRecord = JSON.parse(record.toString());
      if (formData.get("recreate")) {
        await rpc.call("com.atproto.repo.deleteRecord", {
          data: {
            repo: params.repo,
            collection: params.collection,
            rkey: params.rkey,
          },
        });
        await rpc.call("com.atproto.repo.createRecord", {
          data: {
            repo: params.repo,
            collection: params.collection,
            rkey: params.rkey,
            record: editedRecord,
            validate: validate,
          },
        });
      } else {
        await rpc.call("com.atproto.repo.putRecord", {
          data: {
            repo: params.repo,
            collection: params.collection,
            rkey: params.rkey,
            record: editedRecord,
            validate: validate,
          },
        });
      }
      setOpenEdit(false);
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      setEditNotice(err.message);
    }
  });

  const deleteRecord = action(async () => {
    rpc = new XRPC({ handler: agent });
    await rpc.call("com.atproto.repo.deleteRecord", {
      data: {
        repo: params.repo,
        collection: params.collection,
        rkey: params.rkey,
      },
    });
    throw redirect(`/at/${params.repo}/${params.collection}`);
  });

  createEffect(() => {
    if (openDelete() || openEdit()) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    setEditNotice("");
  });

  type AtUri = { repo: string; collection: string; rkey: string };
  type TemplateFn = (uri: AtUri) => { label: string; link: string };
  type TemplateMap = Record<string, TemplateFn>;

  const uriTemplates: TemplateMap = {
    "app.bsky.actor.profile": (uri) => ({
      label: "Bluesky",
      link: `https://bsky.app/profile/${uri.repo}`,
    }),
    "app.bsky.feed.post": (uri) => ({
      label: "Bluesky",
      link: `https://bsky.app/profile/${uri.repo}/post/${uri.rkey}`,
    }),
    "app.bsky.graph.list": (uri) => ({
      label: "Bluesky",
      link: `https://bsky.app/profile/${uri.repo}/lists/${uri.rkey}`,
    }),
    "app.bsky.feed.generator": (uri) => ({
      label: "Bluesky",
      link: `https://bsky.app/profile/${uri.repo}/feed/${uri.rkey}`,
    }),
    "fyi.unravel.frontpage.post": (uri) => ({
      label: "Frontpage",
      link: `https://frontpage.fyi/post/${uri.repo}/${uri.rkey}`,
    }),
    "com.whtwnd.blog.entry": (uri) => ({
      label: "WhiteWind",
      link: `https://whtwnd.com/${uri.repo}/${uri.rkey}`,
    }),
    "com.shinolabs.pinksea.oekaki": (uri) => ({
      label: "PinkSea",
      link: `https://pinksea.art/${uri.repo}/oekaki/${uri.rkey}`,
    }),
    "blue.linkat.board": (uri) => ({
      label: "Linkat",
      link: `https://linkat.blue/${uri.repo}`,
    }),
  };

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
        <div class="i-line-md-loading-twotone-loop text-xl" />
      </Show>
      <Show when={validRecord() === false}>
        <div class="mb-2 break-words">{notice()}</div>
      </Show>
      <Show when={record()}>
        <div class="mb-3 flex w-full justify-center gap-x-2">
          <button
            onclick={() => setJSONSyntax(!JSONSyntax())}
            class="dark:bg-dark-700 dark:hover:bg-dark-800 rounded-lg border border-slate-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
          >
            {JSONSyntax() ? "Markup" : "JSON"}
          </button>
          <Show when={externalLink()}>
            <a
              class="dark:bg-dark-700 dark:hover:bg-dark-800 block flex items-center gap-x-1 rounded-lg border border-slate-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
              target="_blank"
              href={externalLink()?.link}
            >
              {externalLink()?.label}{" "}
              <div class="i-tabler-external-link text-sm" />
            </a>
          </Show>
          <Show
            when={loginState() && agent.sub === record()?.uri.split("/")[2]}
          >
            <Show when={openEdit()}>
              <dialog
                ref={setModal}
                class="fixed left-0 top-0 z-20 flex h-screen w-screen items-center justify-center bg-transparent"
              >
                <div class="dark:bg-dark-400 rounded-md border border-slate-900 bg-slate-100 p-4 text-slate-900 dark:border-slate-100 dark:text-slate-100">
                  <h3 class="mb-2 text-lg font-bold">Editing record</h3>
                  <form action={editRecord} method="post">
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
                    <Editor theme={theme()} model={model!} />
                    <div class="mt-2 flex flex-col gap-2">
                      <div class="text-red-500 dark:text-red-400">
                        {editNotice()}
                      </div>
                      <div class="flex items-center justify-end gap-2">
                        <div class="flex items-center gap-1">
                          <input
                            id="recreate"
                            class="size-4"
                            name="recreate"
                            type="checkbox"
                          />
                          <label for="recreate" class="select-none">
                            Recreate record
                          </label>
                        </div>
                        <button
                          onclick={() => setOpenEdit(false)}
                          class="dark:bg-dark-900 dark:hover:bg-dark-800 rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          class="rounded-lg bg-green-500 px-2.5 py-1.5 text-sm font-bold text-slate-100 hover:bg-green-400 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:bg-green-600 dark:hover:bg-green-500 dark:focus:ring-slate-300"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </dialog>
            </Show>
            <button
              onclick={() => {
                model = editor.createModel(
                  JSON.stringify(record()?.value, null, 2),
                  "json",
                );
                setOpenEdit(true);
              }}
              class="dark:bg-dark-700 dark:hover:bg-dark-800 rounded-lg border border-slate-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
            >
              Edit
            </button>
            <Show when={openDelete()}>
              <dialog
                ref={setModal}
                class="fixed left-0 top-0 z-20 flex h-screen w-screen items-center justify-center bg-transparent"
              >
                <div class="dark:bg-dark-400 rounded-md border border-slate-900 bg-slate-100 p-4 text-slate-900 dark:border-slate-100 dark:text-slate-100">
                  <h3 class="text-lg font-bold">Delete this record?</h3>
                  <form action={deleteRecord} method="post">
                    <div class="mt-2 inline-flex gap-2">
                      <button
                        onclick={() => setOpenDelete(false)}
                        class="dark:bg-dark-900 dark:hover:bg-dark-800 rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
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
              class="rounded-lg bg-red-500 px-2.5 py-1.5 text-sm font-bold text-slate-100 hover:bg-red-400 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:bg-red-600 dark:hover:bg-red-500 dark:focus:ring-slate-300"
            >
              Delete
            </button>
          </Show>
        </div>
        <div class="break-anywhere mt-1 whitespace-pre-wrap pl-3.5 font-mono text-sm sm:text-base">
          <Show when={!JSONSyntax()}>
            <JSONValue
              data={record() as any}
              repo={record()!.uri.split("/")[2]}
            />
          </Show>
          <Show when={JSONSyntax()}>
            <Editor
              theme={theme()}
              model={editor.createModel(
                JSON.stringify(record(), null, 2).replace(
                  /[\u007F-\uFFFF]/g,
                  (chr) =>
                    "\\u" + ("0000" + chr.charCodeAt(0).toString(16)).slice(-4),
                ),
                "json",
              )}
              readOnly={true}
            />
          </Show>
        </div>
      </Show>
    </>
  );
};

export { RecordView };
