import { Client } from "@atcute/client";
import { Did } from "@atcute/lexicons";
import { getSession, OAuthUserAgent } from "@atcute/oauth-browser-client";
import { useNavigate, useParams } from "@solidjs/router";
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { hasAccountScope, hasUserScope } from "../../auth/scope-utils";
import { agent, sessions } from "../../auth/state";
import { addNotification } from "../ui/notification.jsx";
import { iconButtonClass } from "../ui/permission-button.jsx";
import { showPermissionPrompt } from "../ui/permission-prompt";
import Tooltip from "../ui/tooltip.jsx";
import { RecordEditorDialog, type RecordWrite } from "./editor-dialog.jsx";

const [placeholder, setPlaceholder] = createSignal<any>();
export { setPlaceholder };

export const RecordEditor = (props: {
  create: boolean;
  record?: any;
  refetch?: any;
  scope?: "create" | "update" | "delete" | "blob";
  showTrigger?: boolean;
  registerOpen?: (open: (() => void) | undefined) => void;
}) => {
  const navigate = useNavigate();
  const params = useParams();
  const [openDialog, setOpenDialog] = createSignal(false);
  const [selectedRepo, setSelectedRepo] = createSignal<Did | undefined>(agent()?.sub);

  const hasPermission = () => !props.scope || hasUserScope(props.scope);
  const uploadRepo = () => (props.create ? selectedRepo() : agent()?.sub);
  const canUploadBlob = () => {
    const repo = uploadRepo();
    return repo ? hasAccountScope(repo, "blob") : false;
  };

  createEffect(() => {
    setSelectedRepo(agent()?.sub);
  });

  const openEditor = () => {
    if (hasPermission()) {
      setOpenDialog(true);
    } else if (props.scope) {
      showPermissionPrompt(props.scope);
    }
  };

  onMount(() => {
    props.registerOpen?.(openEditor);
    onCleanup(() => props.registerOpen?.(undefined));
  });

  const defaultPlaceholder = () => {
    return {
      $type: "app.bsky.feed.post",
      text: "This post was sent from PDSls",
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://pds.ls",
          title: "PDSls",
          description: "Browse and manage data across the AT Protocol",
        },
      },
      langs: ["en"],
      createdAt: new Date().toISOString(),
    };
  };

  const createRecord = async (write: RecordWrite) => {
    const repo = selectedRepo();
    if (!repo) throw new Error("Choose an account to create the record in");
    const rpc = new Client({
      handler: new OAuthUserAgent(await getSession(repo)),
    });
    const res = await rpc.post("com.atproto.repo.createRecord", {
      input: {
        repo,
        collection: write.collection as `${string}.${string}.${string}`,
        rkey: write.rkey,
        record: write.record,
        validate: write.validate,
      },
    });
    if (!res.ok) throw new Error(`${res.data.error}: ${res.data.message}`);

    addNotification({
      message: "Record created",
      type: "success",
      duration: 3000,
    });
    navigate(`/${res.data.uri}`);
  };

  const editRecord = async (write: RecordWrite) => {
    const rpc = new Client({ handler: agent()! });
    const collection = write.collection as `${string}.${string}.${string}`;
    const rkey = write.rkey!;
    const res = await rpc.post("com.atproto.repo.applyWrites", {
      input: {
        repo: agent()!.sub,
        validate: write.validate,
        writes: write.recreate
          ? [
              {
                $type: "com.atproto.repo.applyWrites#delete",
                collection,
                rkey,
              },
              {
                $type: "com.atproto.repo.applyWrites#create",
                collection,
                rkey,
                value: write.record,
              },
            ]
          : [
              {
                $type: "com.atproto.repo.applyWrites#update",
                collection,
                rkey,
                value: write.record,
              },
            ],
      },
    });
    if (!res.ok) throw new Error(`${res.data.error}: ${res.data.message}`);

    addNotification({
      message: "Record edited",
      type: "success",
      duration: 3000,
    });
    props.refetch();
  };

  const triggerButton = () => (
    <button
      type="button"
      aria-label={props.create ? "Create record" : "Edit record"}
      class={
        hasPermission()
          ? props.create
            ? "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700/50 dark:active:bg-neutral-700"
            : iconButtonClass
          : `flex items-center rounded-md opacity-40 ${props.create ? "gap-1.5 px-2 py-1.5 text-sm" : "p-1.5"}`
      }
      onclick={openEditor}
    >
      <div class={props.create ? "iconify lucide--square-pen" : "iconify lucide--pencil"} />
      <Show when={props.create}>Create</Show>
    </button>
  );

  return (
    <>
      <RecordEditorDialog
        mode={props.create ? "create" : "edit"}
        open={openDialog()}
        onClose={() => setOpenDialog(false)}
        onRequestOpen={openEditor}
        shortcut={props.create ? "n" : "e"}
        content={JSON.stringify(
          !props.create ? props.record : params.rkey ? placeholder() : defaultPlaceholder(),
          null,
          2,
        )}
        collection={props.create ? undefined : params.collection}
        rkey={props.create ? undefined : params.rkey}
        targetPrefix={
          <>
            <span>at://</span>
            <select
              class="dark:bg-dark-100 max-w-40 truncate rounded-md border border-neutral-200 bg-white px-1 py-1 select-none focus:outline-1 focus:outline-neutral-400 dark:border-neutral-600 dark:focus:outline-neutral-400"
              name="repo"
              value={selectedRepo()}
              onChange={(e) => setSelectedRepo(e.currentTarget.value as Did)}
            >
              <For each={Object.keys(sessions)}>
                {(session) => (
                  <option value={session}>{sessions[session].handle ?? session}</option>
                )}
              </For>
            </select>
            <span>/</span>
          </>
        }
        uploadRepo={uploadRepo()}
        canUpload={canUploadBlob()}
        allowRecreate
        onSubmit={props.create ? createRecord : editRecord}
      />
      <Show when={props.showTrigger !== false}>
        <Show
          when={props.create}
          fallback={
            <Tooltip
              text={hasPermission() ? "Edit record" : "Edit record (permission required)"}
              shortcut={hasPermission() ? "E" : undefined}
            >
              {triggerButton()}
            </Tooltip>
          }
        >
          {triggerButton()}
        </Show>
      </Show>
    </>
  );
};
