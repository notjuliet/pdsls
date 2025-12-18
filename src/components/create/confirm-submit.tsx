import { createSignal, Show } from "solid-js";
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
    <div class="dark:bg-dark-300 dark:shadow-dark-700 absolute top-70 left-[50%] w-[24rem] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md transition-opacity duration-200 dark:border-neutral-700 starting:opacity-0">
      <h2 class="mb-3 font-semibold">{props.isCreate ? "Create" : "Edit"} record</h2>
      <div class="flex flex-col gap-3 text-sm">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="dark:bg-dark-100 flex items-center gap-1.5 rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
              onClick={cycleValidate}
            >
              <span
                classList={{
                  iconify: true,
                  "lucide--circle-check text-green-500 dark:text-green-400": validate() === true,
                  "lucide--circle-x text-red-500 dark:text-red-400": validate() === false,
                  "lucide--circle text-neutral-500 dark:text-neutral-400": validate() === undefined,
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
                class="dark:bg-dark-100 flex items-center gap-1.5 rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
                onClick={() => setRecreate(!recreate())}
              >
                <span
                  classList={{
                    iconify: true,
                    "lucide--circle-check text-green-500 dark:text-green-400": recreate(),
                    "lucide--circle text-neutral-500 dark:text-neutral-400": !recreate(),
                  }}
                ></span>
                <span>Recreate</span>
              </button>
            </div>
            <p class="text-xs text-neutral-600 dark:text-neutral-400">
              Delete the existing record and create a new one with the same record key.
            </p>
          </div>
        </Show>
        <div class="mt-1 flex justify-between gap-2">
          <Button onClick={props.onClose}>Cancel</Button>
          <Button
            onClick={() => props.onConfirm(validate(), recreate())}
            class="dark:shadow-dark-700 rounded-lg bg-blue-500 px-2 py-1.5 text-xs text-white shadow-xs select-none hover:bg-blue-600 active:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 dark:active:bg-blue-400"
          >
            {props.isCreate ? "Create" : "Edit"}
          </Button>
        </div>
      </div>
    </div>
  );
};
