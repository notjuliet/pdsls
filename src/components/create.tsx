import {
  createSignal,
  onMount,
  Show,
  type Component,
  onCleanup,
  createEffect,
} from "solid-js";
import { XRPC, XRPCResponse } from "@atcute/client";
import { agent } from "../views/login.jsx";
import { Editor } from "../components/editor.jsx";
import { editor } from "monaco-editor";
import { theme } from "../main.jsx";
import { action, redirect } from "@solidjs/router";
import { ComAtprotoRepoCreateRecord } from "@atcute/client/lexicons";

const CreateRecord: Component = () => {
  const [modal, setModal] = createSignal<HTMLDialogElement>();
  const [openCreate, setOpenCreate] = createSignal(false);
  const [createNotice, setCreateNotice] = createSignal("");
  let model: editor.IModel;
  const placeholder = (date: string) => {
    return {
      $type: "app.bsky.feed.post",
      text: "This post was sent from PDSls",
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://pdsls.dev",
          title: "PDSls",
          description: "Browse and manage atproto repositories",
        },
      },
      langs: ["en"],
      createdAt: date,
    };
  };

  const keyEvent = (event: KeyboardEvent) => {
    if (modal() && event.key == "Escape") setOpenCreate(false);
  };

  onMount(() => window.addEventListener("keydown", keyEvent));

  onCleanup(() => window.removeEventListener("keydown", keyEvent));

  const createRecord = action(async (formData: FormData) => {
    const rpc = new XRPC({ handler: agent });
    const collection = formData.get("collection");
    const rkey = formData.get("rkey");
    let res: XRPCResponse<ComAtprotoRepoCreateRecord.Output>;
    try {
      res = await rpc.call("com.atproto.repo.createRecord", {
        data: {
          repo: agent.sub,
          collection: collection!.toString(),
          rkey: rkey?.toString() ?? undefined,
          record: JSON.parse(model.getValue()),
        },
      });
    } catch (err: any) {
      setCreateNotice(err.message);
      return;
    }
    setOpenCreate(false);
    throw redirect(res.data.uri.replace("at://", "/at/"));
  });

  createEffect(() => {
    if (openCreate()) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    setCreateNotice("");
  });

  return (
    <>
      <Show when={openCreate()}>
        <dialog
          ref={setModal}
          class="fixed left-0 top-0 z-[2] flex h-screen w-screen items-center justify-center bg-transparent"
        >
          <div class="dark:bg-dark-400 rounded-md border border-slate-900 bg-slate-100 p-4 text-slate-900 dark:border-slate-100 dark:text-slate-100">
            <h3 class="mb-2 text-lg font-bold">Creating record</h3>
            <form
              class="flex flex-col gap-y-3"
              action={createRecord}
              method="post"
            >
              <div class="flex w-fit flex-col gap-y-3">
                <div class="flex items-center gap-x-2">
                  <label for="collection" class="basis-1/2 select-none">
                    Collection
                  </label>
                  <input
                    id="collection"
                    name="collection"
                    type="text"
                    required
                    spellcheck={false}
                    value="app.bsky.feed.post"
                    class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
                <div class="flex items-center gap-x-2">
                  <label for="rkey" class="basis-1/2 select-none">
                    Record key
                  </label>
                  <input
                    id="rkey"
                    name="rkey"
                    type="text"
                    spellcheck={false}
                    placeholder="Optional"
                    class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
              </div>
              <Editor theme={theme()} model={model!} />
              <div class="flex flex-col gap-x-2">
                <div class="text-red-500 dark:text-red-400">
                  {createNotice()}
                </div>
                <div class="flex items-center justify-end gap-2">
                  <button
                    onclick={() => setOpenCreate(false)}
                    class="dark:bg-dark-900 dark:hover:bg-dark-800 rounded-lg bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-700 dark:focus:ring-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="rounded-lg bg-green-500 px-2.5 py-1.5 text-sm font-bold text-slate-100 hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-slate-700 dark:bg-green-600 dark:hover:bg-green-500 dark:focus:ring-slate-300"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </form>
          </div>
        </dialog>
      </Show>
      <div
        class="i-octicon-pencil-16 cursor-pointer text-xl"
        title="Create record"
        onclick={() => {
          model = editor.createModel(
            JSON.stringify(placeholder(new Date().toISOString()), null, 2),
            "json",
          );
          setOpenCreate(true);
        }}
      ></div>
    </>
  );
};

export { CreateRecord };
