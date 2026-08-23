import { Show } from "solid-js";

import { Button } from "./button.jsx";

interface RecordSchemaValidationProps {
  valid: boolean | undefined;
  error: string;
  resolving: boolean;
  canResolve: boolean;
  onResolve: () => void;
}

export const RecordSchemaValidation = (props: RecordSchemaValidationProps) => (
  <div>
    <div class="flex items-center gap-1">
      <p class="font-semibold">Schema validation</p>
      <span
        classList={{
          "iconify lucide--check text-green-500 dark:text-green-400": props.valid === true,
          "iconify lucide--x text-red-500 dark:text-red-400": props.valid === false,
          "iconify lucide--loader-circle animate-spin":
            props.valid === undefined && props.resolving,
        }}
      />
    </div>
    <Show when={props.valid === false}>
      <div class="text-xs wrap-break-word">{props.error}</div>
    </Show>
    <Show when={!props.resolving && props.valid === undefined && props.canResolve}>
      <Button onClick={props.onResolve}>Validate via resolution</Button>
    </Show>
  </div>
);
