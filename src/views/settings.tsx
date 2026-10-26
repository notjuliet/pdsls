import { createSignal, For } from "solid-js";

import { TextInput } from "../components/ui/text-input.jsx";
import { ThemeSelection } from "../components/ui/theme.jsx";

const [hideMedia, setHideMedia] = createSignal(localStorage.hideMedia === "true");
export { hideMedia };
const [plcDirectory, setPlcDirectory] = createSignal(
  localStorage.plcDirectory || "https://plc.directory",
);
export { plcDirectory };

const Settings = () => {
  document.title = "Settings - PDSls";
  return (
    <div class="flex w-full flex-col gap-3 px-2">
      <div class="text-lg font-semibold">Settings</div>
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <label for="plcDirectory" class="font-medium select-none">
            PLC Directory
          </label>
          {plcDirectory() !== "https://plc.directory" && (
            <button
              type="button"
              class="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 active:bg-neutral-300 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 dark:active:bg-neutral-600"
              onClick={() => {
                localStorage.removeItem("plcDirectory");
                setPlcDirectory("https://plc.directory");
              }}
            >
              Reset
            </button>
          )}
        </div>
        <TextInput
          id="plcDirectory"
          value={plcDirectory()}
          onInput={(e) => {
            const value = e.currentTarget.value;
            if (value.length) {
              localStorage.plcDirectory = value;
              setPlcDirectory(value);
            } else {
              localStorage.removeItem("plcDirectory");
              setPlcDirectory("https://plc.directory");
            }
          }}
        />
      </div>
      <ThemeSelection />
      <div class="flex flex-col gap-1">
        <label class="font-medium select-none">Media in records</label>
        <div class="flex gap-2">
          <For
            each={[
              { hide: false, label: "Show" },
              { hide: true, label: "Hide" },
            ]}
          >
            {(option) => (
              <button
                classList={{
                  "flex items-center min-w-21 justify-center rounded-xl border px-3 py-2": true,
                  "bg-neutral-200/60 border-neutral-300 dark:border-neutral-500 dark:bg-neutral-700":
                    hideMedia() === option.hide,
                  "border-neutral-200 dark:border-neutral-600 hover:bg-neutral-200/30 dark:hover:bg-neutral-800":
                    hideMedia() !== option.hide,
                }}
                onClick={() => {
                  localStorage.hideMedia = String(option.hide);
                  setHideMedia(option.hide);
                }}
              >
                {option.label}
              </button>
            )}
          </For>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label class="font-medium select-none">Version</label>
        <div class="text-sm text-neutral-600 dark:text-neutral-400">
          {import.meta.env.VITE_APP_VERSION}
        </div>
      </div>
    </div>
  );
};

export { Settings };
