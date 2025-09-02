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

  const ThemeButton = (props: { theme: string; icon: string }) => {
    return (
      <button
        classList={{
          "p-1.5 flex items-center rounded-full": true,
          "bg-neutral-200 dark:bg-neutral-600": theme() === props.theme,
        }}
        onclick={() => updateTheme(props.theme)}
      >
        <span class={"iconify " + props.icon}></span>
      </button>
    );
  };

  return (
    <div class="mt-2 flex items-center justify-between gap-1 text-base">
      <ThemeButton theme="system" icon="lucide--monitor" />
      <ThemeButton theme="light" icon="lucide--sun" />
      <ThemeButton theme="dark" icon="lucide--moon" />
    </div>
  );
};
