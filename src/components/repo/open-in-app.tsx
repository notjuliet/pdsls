import { createSignal, For, type JSX, onCleanup, onMount, Show } from "solid-js";

import { Favicon } from "../ui/favicon.jsx";

interface AppLink {
  label: string;
  link: string;
  /** The domain its icon comes from, when it isn't the link's. */
  hostname?: string;
}

const BSKY = "https://bsky.app";

/** Apps that open bsky.app links at their own domain. */
const bskyClients = [
  { label: "Bluesky", hostname: "bsky.app", origin: BSKY },
  { label: "Blacksky", hostname: "blacksky.app", origin: "https://blacksky.community" },
  { label: "Witchsky", hostname: "witchsky.app", origin: "https://witchsky.app" },
  { label: "Red Dwarf", hostname: "reddwarf.app", origin: "https://reddwarf.app" },
];

const STORAGE_KEY = "bskyClient";

const storedClient = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

// The Bluesky app last picked, which the button opens from then on.
const [preferredClient, setPreferredClient] = createSignal(storedClient());

const pickClient = (label: string) => {
  setPreferredClient(label);
  try {
    localStorage.setItem(STORAGE_KEY, label);
  } catch {}
};

const hostOf = (app: AppLink) => app.hostname ?? new URL(app.link).hostname;

const iconBox = (children: JSX.Element) => (
  <span class="flex size-[1em] shrink-0 items-center justify-center *:size-full!">{children}</span>
);

/** How long the menu stays open after the mouse leaves, so it can cross to the menu. */
const CLOSE_DELAY = 150;

/**
 * A link to the record in the app it belongs to. Bluesky records also get a menu of other
 * Bluesky apps, opened by hovering or by the chevron, and the one picked last becomes the link.
 */
export const OpenInApp = (props: AppLink) => {
  const [open, setOpen] = createSignal(false);
  let container!: HTMLDivElement;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const clients = () =>
    props.link.startsWith(BSKY)
      ? bskyClients.map((client) => ({
          label: client.label,
          hostname: client.hostname,
          link: client.origin + props.link.slice(BSKY.length),
        }))
      : [];
  const current = (): AppLink =>
    clients().find((client) => client.label === preferredClient()) ?? props;

  // Only a mouse opens it on hover; touch has no hover, so it taps the chevron instead.
  const onEnter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !clients().length) return;
    clearTimeout(closeTimer);
    setOpen(true);
  };
  const onLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    closeTimer = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  onMount(() => {
    const onClick = (event: MouseEvent) => {
      if (!container.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      clearTimeout(closeTimer);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    });
  });

  return (
    // One hover background for the link and the chevron, so they read as one button.
    <div
      ref={container}
      class="relative flex items-center rounded-md hover:bg-neutral-200 has-active:bg-neutral-300 dark:hover:bg-neutral-700 dark:has-active:bg-neutral-600"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <a
        href={current().link}
        target="_blank"
        rel="noopener"
        aria-label={`Open on ${current().label}`}
        // Sized in em like the icon buttons next to it, so it grows with the toolbar's text.
        class="flex items-center gap-1.5 rounded-md py-1.5 pl-1.5 leading-none"
        classList={{ "pr-1.5": !clients().length }}
        onClick={() => clients().length && pickClient(current().label)}
      >
        <Favicon domain={hostOf(current())} wrapper={iconBox} />
        <span class="hidden text-sm leading-none sm:inline">{current().label}</span>
      </a>
      <Show when={clients().length}>
        {/* Padded wider than the icon, so it's easy to tap. */}
        <button
          type="button"
          aria-label="Open on another app"
          aria-haspopup="menu"
          aria-expanded={open()}
          class="flex items-center rounded-md py-1.5 pr-1.5 pl-1 text-neutral-500 dark:text-neutral-400"
          // A mouse already opened it by hovering, so its click keeps it open.
          onClick={(event) =>
            setOpen(("pointerType" in event && event.pointerType === "mouse") || !open())
          }
        >
          <span class="iconify lucide--chevron-down" />
        </button>
        <Show when={open()}>
          {/* The top padding bridges the gap, so the mouse doesn't leave on its way down. */}
          <div class="absolute top-full right-0 z-50 pt-1">
            <div
              role="menu"
              class="dark:bg-dark-300 dark:shadow-dark-700 flex min-w-40 flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 text-sm shadow-md dark:border-neutral-700"
            >
              <For each={clients()}>
                {(client) => (
                  <a
                    href={client.link}
                    target="_blank"
                    rel="noopener"
                    role="menuitem"
                    class="flex w-full items-center justify-between gap-3 rounded-md p-1.5 whitespace-nowrap hover:bg-neutral-200/50 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                    onClick={() => {
                      pickClient(client.label);
                      setOpen(false);
                    }}
                  >
                    <span class="flex items-center gap-2">
                      <Favicon domain={client.hostname} />
                      {client.label}
                    </span>
                    <Show when={client.label === current().label}>
                      <span class="iconify lucide--check text-neutral-500 dark:text-neutral-400" />
                    </Show>
                  </a>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};
