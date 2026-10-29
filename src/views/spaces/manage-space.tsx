import { createMemo, createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";

import { SPACE_MANAGE_SPACES_SCOPE_ID } from "../../auth/scope-utils.js";
import { Button } from "../../components/ui/button.jsx";
import { IconButton } from "../../components/ui/icon-button.jsx";
import { Modal } from "../../components/ui/modal.jsx";
import { addNotification } from "../../components/ui/notification.jsx";
import { PermissionButton } from "../../components/ui/permission-button.jsx";
import { Spinner } from "../../components/ui/states.jsx";
import { deleteSimpleSpace, type SimpleSpaceInfo, updateSimpleSpace } from "../../lib/spaces.js";
import { useSpacesAuth } from "./context.jsx";
import {
  defaultSimpleSpaceSettings,
  parseSimpleSpaceSettings,
  SimpleSpaceSettingsFields,
  simpleSpaceSettingsFromInfo,
} from "./simple-space-settings.jsx";

export const ManageSpaceDialog = (props: {
  info: SimpleSpaceInfo;
  space: string;
  onUpdated: (info: SimpleSpaceInfo) => void;
  onDeleted: () => void;
}) => {
  const auth = useSpacesAuth();
  const [open, setOpen] = createSignal(false);
  const [openDelete, setOpenDelete] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [settings, setSettings] = createStore(defaultSimpleSpaceSettings());
  const editableSettings = createMemo(() => simpleSpaceSettingsFromInfo(props.info));

  const openDialog = () => {
    const current = editableSettings();
    if (current) setSettings(current);
    setNotice("");
    setOpenDelete(false);
    setOpen(true);
  };

  const closeDialog = () => {
    if (submitting() || deleting()) return;
    if (openDelete()) {
      setOpenDelete(false);
    } else {
      setOpen(false);
    }
  };

  const save = async () => {
    if (submitting()) return;

    let config;
    try {
      config = parseSimpleSpaceSettings(settings);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Invalid Space configuration");
      return;
    }

    setSubmitting(true);
    setNotice("");
    try {
      await updateSimpleSpace(auth(), props.space, config);
      props.onUpdated({ uri: props.info.uri, ...config });
      setOpen(false);

      addNotification({ message: "Space updated", type: "success", duration: 3000 });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update the Space");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSpace = async () => {
    if (deleting()) return;

    setDeleting(true);
    try {
      await deleteSimpleSpace(auth(), props.space);
      // Stays on the delete step while the dialog fades out; opening it again starts over.
      setOpen(false);

      addNotification({ message: "Space deleted", type: "success", duration: 3000 });
      props.onDeleted();
    } catch (err) {
      addNotification({
        message: err instanceof Error ? err.message : "Could not delete the Space",
        type: "error",
        duration: 5000,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PermissionButton
        scope={SPACE_MANAGE_SPACES_SCOPE_ID}
        class="flex items-center gap-1 rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs transition-colors hover:bg-neutral-200/50 active:bg-neutral-200 sm:px-2 sm:py-0.75 sm:text-sm dark:border-neutral-700 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
        disabledClass="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs opacity-40 sm:px-2 sm:py-1 sm:text-sm"
        onClick={openDialog}
      >
        Manage
      </PermissionButton>

      <Modal
        open={open()}
        onClose={closeDialog}
        closeOnClick={false}
        alignTop
        contentClass="flex max-h-[calc(100vh-5rem)] w-[calc(100%-1rem)] max-w-[30.5rem] flex-col"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold">{openDelete() ? "Delete this Space?" : "Manage Space"}</h2>
          <IconButton icon="lucide--x" label="Close" tooltip={false} onClick={closeDialog} />
        </div>

        <Show
          when={!openDelete()}
          fallback={
            <div>
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                Your records in this Space will be deleted. Other members’ records will become
                inaccessible.
              </p>
              <p class="mt-1 mb-3 text-sm text-neutral-600 dark:text-neutral-400">
                This cannot be undone.
              </p>
              <div class="flex justify-end gap-2">
                <Button disabled={deleting()} onClick={() => setOpenDelete(false)}>
                  Cancel
                </Button>
                <Button disabled={deleting()} onClick={() => void deleteSpace()} variant="danger">
                  <Show when={deleting()}>
                    <Spinner />
                  </Show>
                  {deleting() ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          }
        >
          <div class="-mx-0.5 min-h-0 overflow-y-auto px-0.5">
            <form
              class="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <Show
                when={editableSettings()}
                fallback={
                  <p class="text-sm text-neutral-600 dark:text-neutral-400">
                    This Space uses configuration that PDSls cannot edit.
                  </p>
                }
              >
                <SimpleSpaceSettingsFields settings={settings} setSettings={setSettings} />
              </Show>

              <Show when={notice()}>
                <div class="text-sm text-red-500 dark:text-red-400">{notice()}</div>
              </Show>

              <div class="flex w-full justify-between gap-2">
                <Button
                  disabled={submitting() || deleting()}
                  onClick={() => setOpenDelete(true)}
                  classList={{
                    "border-red-300! text-red-500! hover:bg-red-50! active:bg-red-100! dark:border-red-800! dark:text-red-400! dark:hover:bg-red-950/30! dark:active:bg-red-950/50!": true,
                  }}
                >
                  Delete
                </Button>
                <Show when={editableSettings()}>
                  <Button type="submit" disabled={submitting()} variant="primary">
                    <Show when={submitting()}>
                      <Spinner />
                    </Show>
                    {submitting() ? "Saving…" : "Save"}
                  </Button>
                </Show>
              </div>
            </form>
          </div>
        </Show>
      </Modal>
    </>
  );
};
