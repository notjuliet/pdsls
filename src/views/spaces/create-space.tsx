import { isNsid, isRecordKey } from "@atcute/lexicons/syntax";
import { createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";

import { SPACE_MANAGE_SPACES_SCOPE_ID } from "../../auth/scope-utils.js";
import { Button } from "../../components/ui/button.jsx";
import { IconButton } from "../../components/ui/icon-button.jsx";
import { Modal } from "../../components/ui/modal.jsx";
import { addNotification } from "../../components/ui/notification.jsx";
import { PermissionButton } from "../../components/ui/permission-button.jsx";
import { Spinner } from "../../components/ui/states.jsx";
import { TextInput } from "../../components/ui/text-input.jsx";
import { createSpace, parseSpaceUri, type CreateSpaceResult } from "../../lib/spaces.js";
import { useSpacesAuth } from "./context.jsx";
import {
  defaultSpaceSettings,
  parseSpaceSettings,
  SpaceSettingsFields,
} from "./space-settings.jsx";
import { headerButtonClass, headerButtonDisabledClass } from "./styles.js";

interface CreateSpaceDialogProps {
  onCreated: (result: CreateSpaceResult) => void;
}

export const CreateSpaceDialog = (props: CreateSpaceDialogProps) => {
  const auth = useSpacesAuth();
  const [open, setOpen] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [type, setType] = createSignal("");
  const [skey, setSkey] = createSignal("");
  const [settings, setSettings] = createStore(defaultSpaceSettings());
  const [notice, setNotice] = createSignal("");

  const reset = () => {
    setType("");
    setSkey("");
    setSettings(defaultSpaceSettings());
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

    let policy;
    try {
      policy = parseSpaceSettings(settings);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Invalid Space configuration");
      return;
    }

    setSubmitting(true);
    setNotice("");
    try {
      const result = await createSpace(auth(), {
        type: targetType,
        skey: targetSkey || undefined,
        policy,
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

      addNotification({ message: "Space created", type: "success", duration: 3000 });
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
        class={headerButtonClass}
        disabledClass={headerButtonDisabledClass}
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
        contentClass="flex max-h-[calc(100vh-5rem)] w-[calc(100%-1rem)] max-w-[30.5rem] flex-col"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold">Create Space</h2>
          <IconButton icon="lucide--x" label="Close" tooltip={false} onClick={closeDialog} />
        </div>

        <form
          class="-mx-0.5 flex min-h-0 flex-col gap-4 overflow-y-auto px-0.5"
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

          <SpaceSettingsFields settings={settings} setSettings={setSettings} />

          <Show when={notice()}>
            <div class="text-sm text-red-500 dark:text-red-400">{notice()}</div>
          </Show>

          <div class="flex justify-end">
            <Button type="submit" disabled={submitting()} variant="primary">
              <Show when={submitting()} fallback={<span class="iconify lucide--plus" />}>
                <Spinner />
              </Show>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
