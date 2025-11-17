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
          "p-1.5 flex items-center rounded-full border-[0.5px]": true,
          "bg-neutral-200/60 border-neutral-300/60 dark:border-neutral-500/60 dark:bg-neutral-600":
            theme() === props.theme,
          "border-transparent": theme() !== props.theme,
        }}
        onclick={() => updateTheme(props.theme)}
      >
        <span class={"iconify " + props.icon}></span>
      </button>
    );
  };

  return (
    <div class="dark:bg-dark-100 dark:inset-shadow-dark-200 mt-2 flex items-center justify-between gap-1 rounded-full border-[0.5px] border-neutral-200/60 bg-white p-1 text-base text-neutral-800 inset-shadow-sm dark:border-neutral-600 dark:text-neutral-300">
      <ThemeButton theme="system" icon="lucide--monitor" />
      <ThemeButton theme="light" icon="lucide--sun" />
      <ThemeButton theme="dark" icon="lucide--moon" />
    </div>
  );
};
