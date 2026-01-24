import { createSignal, Show } from "solid-js";
import { hasUserScope } from "../../auth/scope-utils";
import { Button } from "../button.jsx";

export const ConfirmSubmit = (props: {
  isCreate: boolean;
  onConfirm: (validate: boolean | undefined, recreate: boolean) => void;
  onClose: () => void;
}) => {
  const [validate, setValidate] = createSignal<boolean | undefined>(undefined);
  const [recreate, setRecreate] = createSignal(false);

  const getValidateLabel = () => {
    return (
      validate() === true ? "True"
      : validate() === false ? "False"
      : "Unset"
    );
  };

  const cycleValidate = () => {
    setValidate(
      validate() === undefined ? true
      : validate() === true ? false
      : undefined,
    );
  };

  return (
    <>
      <div class="flex flex-col gap-3 text-sm">
        <h2 class="font-semibold">{props.isCreate ? "Create" : "Edit"} record</h2>
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="-ml-2 flex min-w-30 items-center gap-1.5 rounded-lg px-2 py-1 text-xs hover:bg-neutral-200/50 dark:hover:bg-neutral-700"
              onClick={cycleValidate}
            >
              <span
                classList={{
                  iconify: true,
                  "lucide--square-check text-green-500 dark:text-green-400": validate() === true,
                  "lucide--square-x text-red-500 dark:text-red-400": validate() === false,
                  "lucide--square text-neutral-500 dark:text-neutral-400": validate() === undefined,
                }}
              ></span>
              <span>Validate: {getValidateLabel()}</span>
            </button>
          </div>
          <p class="text-xs text-neutral-600 dark:text-neutral-400">
            Set to 'false' to skip lexicon schema validation by the PDS, 'true' to require it, or
            leave unset to validate only for known lexicons.
          </p>
        </div>
        <Show when={!props.isCreate}>
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class={
                  hasUserScope("create") ?
                    "-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs hover:bg-neutral-200/50 dark:hover:bg-neutral-700"
                  : "-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs opacity-40"
                }
                onClick={() => hasUserScope("create") && setRecreate(!recreate())}
              >
                <span
                  classList={{
                    iconify: true,
                    "lucide--square-check text-green-500 dark:text-green-400": recreate(),
                    "lucide--square text-neutral-500 dark:text-neutral-400": !recreate(),
                  }}
                ></span>
                <span>Recreate{hasUserScope("create") ? "" : " (create permission needed)"}</span>
              </button>
            </div>
            <p class="text-xs text-neutral-600 dark:text-neutral-400">
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
    </>
  );
};
