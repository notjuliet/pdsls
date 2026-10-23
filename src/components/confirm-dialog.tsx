import { Show } from "solid-js";

import { Button } from "./button.jsx";
import { Modal } from "./modal.jsx";
import { Spinner } from "./spinner.jsx";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  /** "danger" (the default) for destructive actions. */
  variant?: "primary" | "danger";
  /** While true the dialog can't be dismissed and the confirm button shows a spinner. */
  busy?: boolean;
}

export const ConfirmDialog = (props: ConfirmDialogProps) => (
  <Modal
    open={props.open}
    onClose={() => !props.busy && props.onClose()}
    contentClass="w-[calc(100%-2rem)] max-w-sm"
  >
    <h2 class="font-semibold">{props.title}</h2>
    <Show when={props.description}>
      <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{props.description}</p>
    </Show>
    <div class="mt-3 flex justify-end gap-2">
      <Button disabled={props.busy} onClick={() => props.onClose()}>
        Cancel
      </Button>
      <Button
        variant={props.variant ?? "danger"}
        disabled={props.busy}
        onClick={() => props.onConfirm()}
      >
        <Show when={props.busy}>
          <Spinner centered class="text-xl" />
        </Show>
        {props.confirmLabel}
      </Button>
    </div>
  </Modal>
);
