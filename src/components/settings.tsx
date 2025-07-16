import { createSignal, onMount, Show, onCleanup, createEffect } from "solid-js";
import Tooltip from "./tooltip.jsx";
import { TextInput } from "./text-input.jsx";

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
export const [backlinksEnabled, setBacklinksEnabled] = createSignal(
  localStorage.backlinks === "true",
);
export const [hideMedia, setHideMedia] = createSignal(localStorage.hideMedia === "true");
export const [kawaii, setKawaii] = createSignal(localStorage.kawaii === "true");

const Settings = () => {
  const [modal, setModal] = createSignal<HTMLDialogElement>();
  const [openSettings, setOpenSettings] = createSignal(false);

  const clickEvent = (event: MouseEvent) => {
    if (modal() && event.target == modal()) setOpenSettings(false);
  };
  const keyEvent = (event: KeyboardEvent) => {
    if (modal() && event.key == "Escape") setOpenSettings(false);
  };
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
    window.addEventListener("keydown", keyEvent);
    window.addEventListener("click", clickEvent);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeEvent);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", keyEvent);
    window.removeEventListener("click", clickEvent);
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", themeEvent);
  });

  createEffect(() => {
    if (openSettings()) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "auto";
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
      <Show when={openSettings()}>
        <dialog
          ref={setModal}
          class="starting:backdrop-brightness-100 fixed left-0 top-0 z-20 flex h-screen w-screen items-center justify-center bg-transparent backdrop-brightness-50 transition duration-300"
        >
          <div class="dark:bg-dark-300 top-10% absolute rounded-md bg-zinc-100 p-4 text-slate-900 dark:text-slate-100">
            <h3 class="mb-2 border-b border-neutral-500 pb-2 text-xl font-bold">Settings</h3>
            <h4 class="mb-1 font-semibold">Theme</h4>
            <div class="w-xs flex gap-2 overflow-hidden">
              <button
                classList={{
                  "basis-1/3 py-1 rounded-lg": true,
                  "bg-transparent hover:bg-zinc-200 dark:hover:bg-dark-200": !theme().system,
                  "bg-neutral-500 text-slate-100": theme().system,
                }}
                onclick={() =>
                  updateTheme({
                    color:
                      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
                    system: true,
                  })
                }
              >
                System
              </button>
              <button
                classList={{
                  "basis-1/3 py-1 rounded-lg": true,
                  "bg-transparent hover:bg-zinc-200 dark:hover:bg-dark-200":
                    theme().color !== "light" || theme().system,
                  "bg-neutral-500 text-slate-100": theme().color === "light" && !theme().system,
                }}
                onclick={() => updateTheme({ color: "light", system: false })}
              >
                Light
              </button>
              <button
                classList={{
                  "basis-1/3 py-1 rounded-lg": true,
                  "bg-transparent hover:bg-zinc-200 dark:hover:bg-dark-200":
                    theme().color !== "dark" || theme().system,
                  "bg-neutral-500": theme().color === "dark" && !theme().system,
                }}
                onclick={() => updateTheme({ color: "dark", system: false })}
              >
                Dark
              </button>
            </div>
            <div class="mt-4 flex flex-col gap-1 border-t border-neutral-500 pt-2">
              <div class="flex items-center gap-1">
                <input
                  id="backlinks"
                  class="size-4"
                  type="checkbox"
                  checked={localStorage.backlinks === "true"}
                  onChange={(e) => {
                    localStorage.backlinks = e.currentTarget.checked;
                    setBacklinksEnabled(e.currentTarget.checked);
                  }}
                />
                <label for="backlinks" class="select-none font-semibold">
                  Backlinks
                </label>
                <div class="i-lucide-send-to-back" />
              </div>
              <div class="flex flex-col gap-1">
                <label
                  for="constellation"
                  classList={{
                    "select-none": true,
                    "text-gray-500": !backlinksEnabled(),
                  }}
                >
                  Constellation host
                </label>
                <TextInput
                  id="constellation"
                  value={localStorage.constellationHost || "https://constellation.microcosm.blue"}
                  disabled={!backlinksEnabled()}
                  class="disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:border-gray-700 dark:disabled:bg-gray-800/20"
                  onInput={(e) => {
                    e.currentTarget.value.length ?
                      (localStorage.constellationHost = e.currentTarget.value)
                    : localStorage.removeItem("constellationHost");
                  }}
                />
              </div>
              <div class="mt-2 flex flex-col gap-1 border-t border-neutral-500 pt-2">
                <div class="flex flex-col gap-1">
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
              <div class="mt-2 flex flex-col gap-1 border-t border-neutral-500 pt-2">
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
                <Show when={localStorage.kawaii}>
                  <div class="flex items-center gap-1">
                    <input
                      id="enableKawaii"
                      class="size-4"
                      type="checkbox"
                      checked={localStorage.kawaii === "true"}
                      onChange={(e) => {
                        localStorage.kawaii = e.currentTarget.checked;
                        setKawaii(e.currentTarget.checked);
                      }}
                    />
                    <label for="enableKawaii" class="select-none">
                      Kawaii mode
                    </label>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </dialog>
      </Show>
      <button onclick={() => setOpenSettings(true)}>
        <Tooltip text="Settings" children={<div class="i-lucide-settings text-xl" />} />
      </button>
    </>
  );
};

export { Settings };
