import { createSignal, onMount, onCleanup } from "solid-js";
import Tooltip from "./tooltip.jsx";
import { TextInput } from "./text-input.jsx";
import { Modal } from "./modal.jsx";

const getInitialTheme = () => {
  const isDarkMode =
    localStorage.theme === "dark" ||
    (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return {
    color: isDarkMode ? "dark" : "light",
    system: !("theme" in localStorage),
  };
};

export const [theme, setTheme] = createSignal(getInitialTheme());
export const [hideMedia, setHideMedia] = createSignal(localStorage.hideMedia === "true");

const Settings = () => {
  const [openSettings, setOpenSettings] = createSignal(false);

  const themeEvent = () => {
    if (!theme().system) return;
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(
      isDark ?
        { color: "dark", system: theme().system }
      : { color: "light", system: theme().system },
    );
    document.documentElement.classList.toggle("dark", isDark);
  };

  onMount(() => {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeEvent);
  });

  onCleanup(() => {
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", themeEvent);
  });

  const updateTheme = (newTheme: { color: string; system: boolean }) => {
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme.color === "dark");
    if (newTheme.system) {
      localStorage.removeItem("theme");
    } else {
      localStorage.theme = newTheme.color;
    }
  };

  return (
    <>
      <Modal open={openSettings()} onClose={() => setOpenSettings(false)}>
        <div class="dark:bg-dark-800/70 dark:shadow-dark-900/80 absolute top-12 left-[50%] w-[22rem] -translate-x-1/2 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-200/70 p-4 text-neutral-900 shadow-md backdrop-blur-xs transition-opacity duration-300 dark:border-neutral-700 dark:text-neutral-200 starting:opacity-0">
          <div class="mb-2 flex items-center gap-1 font-bold">
            <span class="iconify lucide--settings"></span>
            <span>Settings</span>
          </div>
          <div class="flex flex-col gap-2">
            <div class="flex flex-col gap-0.5">
              <label for="plcDirectory" class="select-none">
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
            <div class="flex justify-between">
              <div class="flex items-center gap-1">
                <input
                  id="disableMedia"
                  class="size-4"
                  type="checkbox"
                  checked={localStorage.hideMedia === "true"}
                  onChange={(e) => {
                    localStorage.hideMedia = e.currentTarget.checked;
                    setHideMedia(e.currentTarget.checked);
                  }}
                />
                <label for="disableMedia" class="select-none">
                  Hide media embeds
                </label>
              </div>
              <div class="dark:shadow-dark-900/80 dark:bg-dark-100 flex items-center gap-1 rounded-full bg-white p-0.5 text-lg shadow-sm">
                <button
                  name="System Theme"
                  classList={{
                    "p-1.5 flex items-center rounded-full": true,
                    "bg-neutral-200 dark:bg-dark-400": theme().system,
                  }}
                  onclick={() =>
                    updateTheme({
                      color:
                        window.matchMedia("(prefers-color-scheme: dark)").matches ?
                          "dark"
                        : "light",
                      system: true,
                    })
                  }
                >
                  <span class="iconify lucide--monitor"></span>
                </button>
                <button
                  name="Light Theme"
                  classList={{
                    "p-1.5 flex items-center rounded-full": true,
                    "bg-neutral-200": theme().color === "light" && !theme().system,
                  }}
                  onclick={() => updateTheme({ color: "light", system: false })}
                >
                  <span class="iconify lucide--sun"></span>
                </button>
                <button
                  name="Dark Theme"
                  classList={{
                    "p-1.5 flex items-center rounded-full": true,
                    "bg-dark-400": theme().color === "dark" && !theme().system,
                  }}
                  onclick={() => updateTheme({ color: "dark", system: false })}
                >
                  <span class="iconify lucide--moon"></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
      <button onclick={() => setOpenSettings(true)}>
        <Tooltip
          text="Settings"
          children={<span class="iconify lucide--settings text-xl"></span>}
        />
      </button>
    </>
  );
};

export { Settings };
