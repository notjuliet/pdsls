import { createSignal, onMount, Show, onCleanup, createEffect } from "solid-js";
import { XRPC, XRPCResponse } from "@atcute/client";
import { agent } from "../components/login.jsx";
import { Editor } from "../components/editor.jsx";
import { editor } from "monaco-editor";
import { theme } from "../components/settings.jsx";
import { ComAtprotoRepoCreateRecord } from "@atcute/client/lexicons";
import Tooltip from "./tooltip.jsx";

const CreateRecord = () => {
  const [modal, setModal] = createSignal<HTMLDialogElement>();
  const [openCreate, setOpenCreate] = createSignal(false);
  const [createNotice, setCreateNotice] = createSignal("");
  let model: editor.IModel;
  let formRef!: HTMLFormElement;

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

  const createRecord = async (formData: FormData) => {
    const rpc = new XRPC({ handler: agent });
    const collection = formData.get("collection");
    const rkey = formData.get("rkey");
    const validate = formData.get("validate")?.toString();
    let res: XRPCResponse<ComAtprotoRepoCreateRecord.Output>;
    try {
      const record = JSON.parse(model.getValue());
      res = await rpc.call("com.atproto.repo.createRecord", {
        data: {
          repo: agent.sub,
          collection: collection ? collection.toString() : record.$type,
          rkey: rkey?.toString().length ? rkey?.toString() : undefined,
          record: record,
          validate:
            validate === "true" ? true
            : validate === "false" ? false
            : undefined,
        },
      });
    } catch (err: any) {
      setCreateNotice(err.message);
      return;
    }
    setOpenCreate(false);
    window.location.href = `/${res.data.uri}`;
  };

  createEffect(() => {
    if (openCreate()) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
    setCreateNotice("");
  });

  const createModel = () => {
    if (!model)
      model = editor.createModel(
        JSON.stringify(placeholder(new Date().toISOString()), null, 2),
        "json",
      );
  };

  return (
    <>
      <Show when={openCreate()}>
        <dialog
          ref={setModal}
          class="backdrop-brightness-60 fixed left-0 top-0 z-20 flex h-screen w-screen items-center justify-center bg-transparent"
        >
          <div class="dark:bg-dark-400 rounded-md border border-slate-900 bg-slate-100 p-4 text-slate-900 dark:border-slate-100 dark:text-slate-100">
            <h3 class="mb-2 text-lg font-bold">Creating record</h3>
            <form ref={formRef} class="flex flex-col gap-y-3">
              <div class="flex w-fit flex-col gap-y-3">
                <div class="flex items-center gap-x-2">
                  <label for="collection" class="min-w-20 select-none">
                    Collection
                  </label>
                  <input
                    id="collection"
                    name="collection"
                    type="text"
                    spellcheck={false}
                    placeholder="Optional (default: record type)"
                    size={22}
                    class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
                <div class="flex items-center gap-x-2">
                  <label for="rkey" class="min-w-20 select-none">
                    Record key
                  </label>
                  <input
                    id="rkey"
                    name="rkey"
                    type="text"
                    spellcheck={false}
                    placeholder="Optional"
                    size={22}
                    class="dark:bg-dark-100 rounded-lg border border-gray-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
                <div class="flex items-center gap-x-2">
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
              </div>
              <Editor theme={theme().color} model={model!} />
              <div class="flex flex-col gap-x-2">
                <div class="text-red-500 dark:text-red-400">{createNotice()}</div>
                <div class="flex items-center justify-end gap-2">
                  <button
                    onclick={() => setOpenCreate(false)}
                    class="dark:bg-dark-900 dark:hover:bg-dark-800 rounded-lg border border-slate-400 bg-white px-2.5 py-1.5 text-sm font-bold hover:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:focus:ring-slate-300"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onclick={() => createRecord(new FormData(formRef))}
                    class="rounded-lg bg-green-500 px-2.5 py-1.5 text-sm font-bold text-slate-100 hover:bg-green-400 focus:outline-none focus:ring-1 focus:ring-slate-700 dark:bg-green-600 dark:hover:bg-green-500 dark:focus:ring-slate-300"
                  >
                    Create
                  </button>
                </div>
              </div>
            </form>
          </div>
        </dialog>
      </Show>
      <Tooltip
        text="Create record"
        children={
          <button
            class="i-lucide-pencil cursor-pointer text-xl"
            onclick={() => {
              createModel();
              setOpenCreate(true);
            }}
          />
        }
      />
    </>
  );
};

export { CreateRecord };
