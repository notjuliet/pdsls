import { isNsid, isRecordKey } from "@atcute/lexicons/syntax";
import { createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";

import { SPACE_MANAGE_SPACES_SCOPE_ID } from "../../auth/scope-utils.js";
import { Button } from "../../components/button.jsx";
import { Modal } from "../../components/modal.jsx";
import { addNotification, removeNotification } from "../../components/notification.jsx";
import { PermissionButton } from "../../components/permission-button.jsx";
import { TextInput } from "../../components/text-input.jsx";
import {
  createSimpleSpace,
  parseSpaceUri,
  type CreateSimpleSpaceResult,
} from "../../lib/spaces.js";
import { useSpacesAuth } from "./context.jsx";
import {
  defaultSimpleSpaceSettings,
  parseSimpleSpaceSettings,
  SimpleSpaceSettingsFields,
} from "./simple-space-settings.jsx";

interface CreateSpaceDialogProps {
  onCreated: (result: CreateSimpleSpaceResult) => void;
}

export const CreateSpaceDialog = (props: CreateSpaceDialogProps) => {
  const auth = useSpacesAuth();
  const [open, setOpen] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [type, setType] = createSignal("");
  const [skey, setSkey] = createSignal("");
  const [settings, setSettings] = createStore(defaultSimpleSpaceSettings());
  const [notice, setNotice] = createSignal("");

  const reset = () => {
    setType("");
    setSkey("");
    setSettings(defaultSimpleSpaceSettings());
    setNotice("");
  };

  const openDialog = () => {
    reset();
    setOpen(true);
  };

  const closeDialog = () => {
    if (!submitting()) setOpen(false);
  };

  const submit = async () => {
    if (submitting()) return;

    const targetType = type().trim();
    if (!isNsid(targetType)) {
      setNotice("Space type must be a valid NSID, such as app.example.group");
      return;
    }

    const targetSkey = skey().trim();
    if (targetSkey && !isRecordKey(targetSkey)) {
      setNotice("Space key must be 1–512 characters using a-z, A-Z, 0-9, ., _, ~, :, or -");
      return;
    }

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
      const result = await createSimpleSpace(auth(), {
        type: targetType,
        skey: targetSkey || undefined,
        ...config,
      });
      const parsed = parseSpaceUri(result.uri);
      if (!parsed || parsed.authority !== auth().sub || parsed.type !== targetType) {
        throw new Error("The PDS returned an unexpected Space URI");
      }
      if (targetSkey && parsed.skey !== targetSkey) {
        throw new Error("The PDS returned an unexpected Space key");
      }

      setOpen(false);
      props.onCreated(result);

      const notification = addNotification({ message: "Space created", type: "success" });
      setTimeout(() => removeNotification(notification), 3000);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not create the Space");
    } finally {
      setSubmitting(false);
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
        <span class="iconify lucide--plus" />
        <span>Create</span>
      </PermissionButton>

      <Modal
        open={open()}
        onClose={closeDialog}
        closeOnClick={false}
        alignTop
        contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto flex max-h-[calc(100vh-5rem)] w-[calc(100%-1rem)] max-w-[30.5rem] flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold">Create Space</h2>
          <button
            type="button"
            aria-label="Close"
            onclick={closeDialog}
            class="flex items-center rounded-lg p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
          >
            <span class="iconify lucide--x" />
          </button>
        </div>

        <form
          class="flex min-h-0 flex-col gap-4 overflow-y-auto px-0.5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">Space type</span>
            <TextInput
              value={type()}
              onInput={(event) => setType(event.currentTarget.value)}
              placeholder="app.example.group"
              class="w-full"
              required
            />
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              The NSID describing what kind of Space this is.
            </span>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">
              Space key <span class="font-normal text-neutral-500">(optional)</span>
            </span>
            <TextInput
              value={skey()}
              onInput={(event) => setSkey(event.currentTarget.value)}
              placeholder="Generated TID"
              class="w-full"
            />
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              Distinguishes Spaces of the same type under your account.
            </span>
          </label>

          <SimpleSpaceSettingsFields settings={settings} setSettings={setSettings} />

          <Show when={notice()}>
            <div class="text-sm text-red-500 dark:text-red-400">{notice()}</div>
          </Show>

          <div class="flex justify-end">
            <Button
              type="submit"
              disabled={submitting()}
              classList={{
                "bg-blue-500! text-white! hover:bg-blue-600! active:bg-blue-700! dark:bg-blue-600! dark:hover:bg-blue-500! dark:active:bg-blue-400! border-none! disabled:opacity-60": true,
              }}
            >
              <Show when={submitting()} fallback={<span class="iconify lucide--plus" />}>
                <span class="iconify lucide--loader-circle animate-spin" />
              </Show>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
