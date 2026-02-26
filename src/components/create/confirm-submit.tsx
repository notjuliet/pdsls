import { createSignal, For, Show } from "solid-js";
import { hasUserScope } from "../../auth/scope-utils";
import { Button } from "../button.jsx";

const VALIDATE_OPTIONS: { label: string; value: boolean | undefined }[] = [
  { label: "Unset", value: undefined },
  { label: "True", value: true },
  { label: "False", value: false },
];

const activeClass = "bg-neutral-200 font-medium dark:bg-neutral-600";
const inactiveClass = "hover:bg-neutral-100 dark:hover:bg-neutral-700";

export const ConfirmSubmit = (props: {
  isCreate: boolean;
  onConfirm: (validate: boolean | undefined, recreate: boolean) => void;
  onClose: () => void;
}) => {
  const [validate, setValidate] = createSignal<boolean | undefined>(undefined);
  const [recreate, setRecreate] = createSignal(false);

  return (
    <div class="flex flex-col gap-3 text-sm">
      <h2 class="font-semibold">{props.isCreate ? "Create" : "Edit"} record</h2>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <span>Validate</span>
          <div class="flex overflow-hidden rounded-md border border-neutral-200 text-xs dark:border-neutral-600">
            <For each={VALIDATE_OPTIONS}>
              {(opt) => (
                <button
                  type="button"
                  onClick={() => setValidate(opt.value)}
                  class={`border-r border-neutral-200 px-2.5 py-1.5 transition-colors last:border-r-0 dark:border-neutral-600 ${validate() === opt.value ? activeClass : inactiveClass}`}
                >
                  {opt.label}
                </button>
              )}
            </For>
          </div>
        </div>
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          Set to 'false' to skip lexicon schema validation by the PDS, 'true' to require it, or
          leave unset to validate only for known lexicons.
        </p>
      </div>

      <Show when={!props.isCreate}>
        <div class="flex flex-col gap-1.5">
          <label
            class={`flex items-center gap-2 text-sm ${!hasUserScope("create") ? "opacity-40" : ""}`}
          >
            <input
              type="checkbox"
              checked={recreate()}
              disabled={!hasUserScope("create")}
              onChange={(e) => setRecreate(e.currentTarget.checked)}
              class="h-3.5 w-3.5 accent-blue-500"
            />
            Recreate{!hasUserScope("create") ? " (create permission needed)" : ""}
          </label>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Delete the existing record and create a new one with the same record key.
          </p>
        </div>
      </Show>

      <div class="flex justify-between gap-2">
        <Button onClick={props.onClose}>Cancel</Button>
        <Button
          onClick={() => props.onConfirm(validate(), recreate())}
          classList={{
            "bg-blue-500! text-white! border-none! hover:bg-blue-600! active:bg-blue-700! dark:bg-blue-600! dark:hover:bg-blue-500! dark:active:bg-blue-400!": true,
          }}
        >
          {props.isCreate ? "Create" : "Edit"}
        </Button>
      </div>
    </div>
  );
};
