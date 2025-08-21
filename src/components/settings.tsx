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
export const [showHandle, setShowHandle] = createSignal(localStorage.showHandle === "true");
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
        <div class="starting:opacity-0 w-22rem dark:bg-dark-800/70 border-0.5 dark:shadow-dark-900/80 backdrop-blur-xs left-50% absolute top-12 -translate-x-1/2 rounded-lg border-neutral-300 bg-neutral-200/70 p-4 text-neutral-900 shadow-md transition-opacity duration-300 dark:border-neutral-700 dark:text-neutral-200">
          <div class="mb-3 flex items-center gap-1 font-bold">
            <div class="i-lucide-settings" />
            <span>Settings</span>
          </div>
          <h4 class="mb-1 font-semibold">Theme</h4>
          <div class="flex w-full gap-1">
            <button
              classList={{
                "basis-1/3 py-1 rounded-full justify-center flex items-center gap-1": true,
                "bg-transparent hover:bg-neutral-100 dark:hover:bg-dark-200": !theme().system,
                "bg-white dark:bg-neutral-600 font-semibold": theme().system,
              }}
              onclick={() =>
                updateTheme({
                  color:
                    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
                  system: true,
                })
              }
            >
              <div class="i-lucide-monitor" />
              System
            </button>
            <button
              classList={{
                "basis-1/3 py-1 rounded-full justify-center flex items-center gap-1": true,
                "bg-transparent hover:bg-neutral-100 dark:hover:bg-dark-200":
                  theme().color !== "light" || theme().system,
                "bg-white font-semibold": theme().color === "light" && !theme().system,
              }}
              onclick={() => updateTheme({ color: "light", system: false })}
            >
              <div class="i-lucide-sun" />
              Light
            </button>
            <button
              classList={{
                "basis-1/3 py-1 justify-center rounded-full flex items-center gap-1": true,
                "bg-transparent hover:bg-neutral-100 dark:hover:bg-dark-200":
                  theme().color !== "dark" || theme().system,
                "bg-neutral-600 font-semibold": theme().color === "dark" && !theme().system,
              }}
              onclick={() => updateTheme({ color: "dark", system: false })}
            >
              <div class="i-lucide-moon" />
              Dark
            </button>
          </div>
          <div class="mt-3 flex flex-col gap-1">
            <div class="flex flex-col gap-0.5">
              <label for="constellation" class="select-none font-semibold">
                Backlinks host
              </label>
              <TextInput
                id="constellation"
                value={localStorage.constellationHost || "https://constellation.microcosm.blue"}
                onInput={(e) => {
                  e.currentTarget.value.length ?
                    (localStorage.constellationHost = e.currentTarget.value)
                  : localStorage.removeItem("constellationHost");
                }}
              />
            </div>
            <div class="mt-3 flex flex-col gap-1">
              <div class="flex flex-col gap-0.5">
                <label for="plcDirectory" class="select-none font-semibold">
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
            </div>
            <div class="mt-3 flex flex-col gap-1">
              <div class="flex items-center gap-1">
                <input
                  id="showHandle"
                  class="size-4"
                  type="checkbox"
                  checked={localStorage.showHandle === "true"}
                  onChange={(e) => {
                    localStorage.showHandle = e.currentTarget.checked;
                    setShowHandle(e.currentTarget.checked);
                  }}
                />
                <label for="showHandle" class="select-none">
                  Default to showing handle
                </label>
              </div>
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
            </div>
          </div>
        </div>
      </Modal>
      <button onclick={() => setOpenSettings(true)}>
        <Tooltip text="Settings" children={<div class="i-lucide-settings text-xl" />} />
      </button>
    </>
  );
};

export { Settings };
