import { createSignal } from "solid-js";
import { TextInput } from "../components/text-input.jsx";
import { ThemeSelection } from "../components/theme.jsx";

export const [hideMedia, setHideMedia] = createSignal(localStorage.hideMedia === "true");
export const [plcDirectory, setPlcDirectory] = createSignal(
  localStorage.plcDirectory || "https://plc.directory",
);

const Settings = () => {
  document.title = "Settings - PDSls";
  return (
    <div class="flex w-full flex-col gap-2 px-2">
      <div class="text-lg font-semibold">Settings</div>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label for="plcDirectory" class="font-medium select-none">
            PLC Directory
          </label>
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
