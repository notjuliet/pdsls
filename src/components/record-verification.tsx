import { Show } from "solid-js";

interface RecordVerificationProps {
  valid: boolean | undefined;
  error: string;
}

export const RecordVerification = (props: RecordVerificationProps) => (
  <div>
    <div class="flex items-center gap-1">
      <p class="font-semibold">Record verification</p>
      <span
        classList={{
          "iconify lucide--check text-green-500 dark:text-green-400": props.valid === true,
          "iconify lucide--x text-red-500 dark:text-red-400": props.valid === false,
          "iconify lucide--loader-circle animate-spin": props.valid === undefined,
        }}
      />
    </div>
    <Show when={props.valid === false}>
      <div class="text-xs wrap-break-word">{props.error}</div>
    </Show>
  </div>
);
