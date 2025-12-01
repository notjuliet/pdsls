import { createSignal } from "solid-js";

export const themeEvent = () => {
  if (localStorage.getItem("theme") !== null) return;
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", isDark);
};

export const ThemeSelection = () => {
  const [theme, setTheme] = createSignal(
    localStorage.getItem("theme") === null ? "system"
    : localStorage.theme === "dark" ? "dark"
    : "light",
  );

  const updateTheme = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.classList.toggle(
      "dark",
      newTheme === "dark" ||
        (newTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches),
    );
    if (newTheme === "system") localStorage.removeItem("theme");
    else localStorage.theme = newTheme;
  };

  const ThemeOption = (props: { theme: string; icon: string; label: string }) => {
    return (
      <button
        classList={{
          "flex items-center gap-2 rounded-xl border px-3 py-2": true,
          "bg-neutral-200/60 border-neutral-300 dark:border-neutral-500 dark:bg-neutral-700":
            theme() === props.theme,
          "border-neutral-200 dark:border-neutral-600 hover:bg-neutral-200/30 dark:hover:bg-neutral-800":
            theme() !== props.theme,
        }}
        onclick={() => updateTheme(props.theme)}
      >
        <span class={"iconify " + props.icon}></span>
        <span>{props.label}</span>
      </button>
    );
  };

  return (
    <div class="flex flex-col gap-0.5">
      <label class="select-none">Theme</label>
      <div class="flex gap-2">
        <ThemeOption theme="system" icon="lucide--monitor" label="System" />
        <ThemeOption theme="light" icon="lucide--sun" label="Light" />
        <ThemeOption theme="dark" icon="lucide--moon" label="Dark" />
      </div>
    </div>
  );
};
