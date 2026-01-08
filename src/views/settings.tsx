import { Title } from "@solidjs/meta";
import { createSignal } from "solid-js";
import { TextInput } from "../components/text-input.jsx";
import { ThemeSelection } from "../components/theme.jsx";

export const [hideMedia, setHideMedia] = createSignal(localStorage.hideMedia === "true");

const Settings = () => {
  return (
    <div class="flex w-full flex-col gap-2 px-2">
      <Title>Settings - PDSls</Title>
      <div class="text-lg font-semibold">Settings</div>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label for="plcDirectory" class="font-medium select-none">
            PLC Directory
          </label>
          <TextInput
            id="plcDirectory"
            value={localStorage.plcDirectory || "https://plc.directory"}
            onInput={(e) => {
              e.currentTarget.value.length ?
                (localStorage.plcDirectory = e.currentTarget.value)
              : localStorage.removeItem("plcDirectory");
            }}
          />
        </div>
        <ThemeSelection />
        <div class="flex flex-col gap-1">
          <label class="font-medium select-none">Blob media preview</label>
          <div class="flex gap-2">
            <button
              classList={{
                "flex min-w-21 items-center justify-center gap-1 rounded-xl border px-3 py-2": true,
                "border-neutral-300 bg-neutral-200/60 dark:border-neutral-500 dark:bg-neutral-700":
                  !hideMedia(),
                "border-neutral-200 hover:bg-neutral-200/30 dark:border-neutral-600 dark:hover:bg-neutral-800":
                  hideMedia(),
              }}
              onClick={() => {
                localStorage.hideMedia = "false";
                setHideMedia(false);
              }}
            >
              Show
            </button>
            <button
              classList={{
                "flex min-w-21 items-center justify-center gap-1 rounded-xl border px-3 py-2": true,
                "border-neutral-300 bg-neutral-200/60 dark:border-neutral-500 dark:bg-neutral-700":
                  hideMedia(),
                "border-neutral-200 hover:bg-neutral-200/30 dark:border-neutral-600 dark:hover:bg-neutral-800":
                  !hideMedia(),
              }}
              onClick={() => {
                localStorage.hideMedia = "true";
                setHideMedia(true);
              }}
            >
              Hide
            </button>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-medium select-none">Version</label>
          <div class="text-sm text-neutral-600 dark:text-neutral-400">
            {import.meta.env.VITE_APP_VERSION}
          </div>
        </div>
      </div>
    </div>
  );
};

export { Settings };
