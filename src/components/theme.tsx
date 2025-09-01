import { createSignal } from "solid-js";

const getInitialTheme = () => {
  const isDarkMode =
    localStorage.theme === "dark" ||
    (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return { color: isDarkMode ? "dark" : "light", system: !("theme" in localStorage) };
};

export const themeEvent = () => {
  if (!theme().system) return;
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme({ color: isDark ? "dark" : "light", system: theme().system });
  document.documentElement.classList.toggle("dark", isDark);
};

export const [theme, setTheme] = createSignal(getInitialTheme());

export const ThemeSelection = () => {
  const updateTheme = (newTheme: { color: string; system: boolean }) => {
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme.color === "dark");
    if (newTheme.system) localStorage.removeItem("theme");
    else localStorage.theme = newTheme.color;
  };

  return (
    <div class="mt-2 flex items-center justify-between gap-1 text-base">
      <button
        name="System Theme"
        classList={{
          "p-1.5 flex items-center rounded-full": true,
          "bg-neutral-200 dark:bg-neutral-600": theme().system,
        }}
        onclick={() =>
          updateTheme({
            color: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
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
          "bg-neutral-600": theme().color === "dark" && !theme().system,
        }}
        onclick={() => updateTheme({ color: "dark", system: false })}
      >
        <span class="iconify lucide--moon"></span>
      </button>
    </div>
  );
};
