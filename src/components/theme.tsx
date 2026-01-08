import { createSignal } from "solid-js";

export const themeEvent = () => {
  if (localStorage.getItem("theme") !== null) return;
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", isDark);
};

export const ThemeSelection = () => {
  const [theme, setTheme] = createSignal(
    localStorage.getItem("theme") === null ? "auto"
    : localStorage.theme === "dark" ? "dark"
    : "light",
  );

  const updateTheme = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.classList.toggle(
      "dark",
      newTheme === "dark" ||
        (newTheme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches),
    );
    if (newTheme === "auto") localStorage.removeItem("theme");
    else localStorage.theme = newTheme;
  };

  const ThemeOption = (props: { theme: string; label: string }) => {
    return (
      <button
        classList={{
          "flex items-center min-w-21 justify-center rounded-xl border px-3 py-2": true,
          "bg-neutral-200/60 border-neutral-300 dark:border-neutral-500 dark:bg-neutral-700":
            theme() === props.theme,
          "border-neutral-200 dark:border-neutral-600 hover:bg-neutral-200/30 dark:hover:bg-neutral-800":
            theme() !== props.theme,
        }}
        onclick={() => updateTheme(props.theme)}
      >
        {props.label}
      </button>
    );
  };

  return (
    <div class="flex flex-col gap-1">
      <label class="font-medium select-none">Theme</label>
      <div class="flex gap-2">
        <ThemeOption theme="auto" label="Auto" />
        <ThemeOption theme="light" label="Light" />
        <ThemeOption theme="dark" label="Dark" />
      </div>
    </div>
  );
};
