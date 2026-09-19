import { A, RouteSectionProps, useIsRouting, useLocation } from "@solidjs/router";
import { createEffect, ErrorBoundary, on, onCleanup, onMount, Show, Suspense } from "solid-js";

import { AccountManager } from "./auth/account.jsx";
import { agent } from "./auth/state.js";
import { RecordEditor } from "./components/create";
import { NavBar } from "./components/navbar.jsx";
import { NotificationContainer } from "./components/notification.jsx";
import { PermissionPromptContainer } from "./components/permission-prompt.jsx";
import { Search } from "./components/search.jsx";
import { Spinner } from "./components/spinner.jsx";
import { themeEvent } from "./components/theme.jsx";
import { plcDirectory } from "./views/settings.jsx";

export const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const SCROLL_POSITION_KEY = "pdsls:scroll-position";

interface SavedScrollPosition {
  url: string;
  top: number;
}

const consumeSavedScrollPosition = (documentUrl: string): SavedScrollPosition | undefined => {
  let saved: string | null;

  try {
    saved = sessionStorage.getItem(SCROLL_POSITION_KEY);
    sessionStorage.removeItem(SCROLL_POSITION_KEY);
  } catch {
    return;
  }

  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (!saved || navigation?.type !== "reload") return;

  try {
    const parsed = JSON.parse(saved) as SavedScrollPosition;
    if (parsed.url !== documentUrl) return;
    if (!Number.isFinite(parsed.top)) return;
    return parsed;
  } catch {
    return;
  }
};

const restoreScrollPosition = (saved: SavedScrollPosition, content: HTMLElement) => {
  let frame: number | undefined;
  let timeout: number | undefined;
  const cancelEvents: (keyof WindowEventMap)[] = ["keydown", "pointerdown", "touchstart", "wheel"];

  const cleanup = () => {
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    if (timeout !== undefined) clearTimeout(timeout);
    for (const event of cancelEvents) window.removeEventListener(event, cleanup);
  };

  const attempt = () => {
    frame = undefined;
    window.scrollTo(0, saved.top);
    if (Math.abs(window.scrollY - saved.top) <= 1) cleanup();
  };

  const schedule = () => {
    if (frame === undefined) frame = requestAnimationFrame(attempt);
  };

  const observer = new ResizeObserver(schedule);
  observer.observe(content);
  for (const event of cancelEvents) window.addEventListener(event, cleanup, { once: true });
  timeout = window.setTimeout(cleanup, 10_000);
  schedule();

  return cleanup;
};

const Layout = (props: RouteSectionProps<unknown>) => {
  let openCreateRecord: (() => void) | undefined;
  const location = useLocation();
  const isRouting = useIsRouting();
  const savedScroll = consumeSavedScrollPosition(window.location.href);
  let stablePath = location.pathname;
  createEffect(() => {
    if (!isRouting()) stablePath = location.pathname;
  });

  if (location.search.includes("hrt=true")) localStorage.setItem("hrt", "true");
  else if (location.search.includes("hrt=false")) localStorage.setItem("hrt", "false");
  if (location.search.includes("sailor=true")) localStorage.setItem("sailor", "true");
  else if (location.search.includes("sailor=false")) localStorage.setItem("sailor", "false");

  onMount(() => {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeEvent);

    const saveScrollPosition = () => {
      try {
        sessionStorage.setItem(
          SCROLL_POSITION_KEY,
          JSON.stringify({
            url: window.location.href,
            top: window.scrollY,
          } satisfies SavedScrollPosition),
        );
      } catch {
        // Storage may be unavailable in privacy-restricted browser contexts.
      }
    };

    const stopRestoring = savedScroll
      ? restoreScrollPosition(savedScroll, document.getElementById("main")!)
      : undefined;

    window.addEventListener("pagehide", saveScrollPosition);

    onCleanup(() => {
      window.removeEventListener("pagehide", saveScrollPosition);
      stopRestoring?.();
    });

    if (localStorage.getItem("sailor") === "true") {
      const style = document.createElement("style");
      style.textContent = `
          html, * {
            cursor: url(/cursor.cur), pointer;
          }

          .star {
            position: fixed;
            pointer-events: none;
            z-index: 9999;
            font-size: 20px;
            animation: sparkle 0.8s ease-out forwards;
          }

          @keyframes sparkle {
            0% {
              opacity: 1;
              transform: translate(0, 0) rotate(var(--ttheta1)) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(var(--tx), var(--ty)) rotate(var(--ttheta2)) scale(0);
            }
          }
        `;
      document.head.appendChild(style);

      let lastTime = 0;
      const throttleDelay = 30;

      document.addEventListener("mousemove", (e) => {
        const now = Date.now();
        if (now - lastTime < throttleDelay) return;
        lastTime = now;

        const star = document.createElement("div");
        star.className = "star";
        star.textContent = "✨";
        star.style.left = e.clientX + "px";
        star.style.top = e.clientY + "px";

        const tx = (Math.random() - 0.5) * 50;
        const ty = (Math.random() - 0.5) * 50;
        const ttheta1 = Math.random() * 360;
        const ttheta2 = ttheta1 + (Math.random() - 0.5) * 540;
        star.style.setProperty("--tx", tx + "px");
        star.style.setProperty("--ty", ty + "px");
        star.style.setProperty("--ttheta1", ttheta1 + "deg");
        star.style.setProperty("--ttheta2", ttheta2 + "deg");

        document.body.appendChild(star);

        setTimeout(() => star.remove(), 800);
      });
    }
  });

  return (
    <div id="main" class="mx-auto mb-8 flex max-w-xl flex-col items-center p-3">
      <header class="mb-3 flex h-10 w-full items-center gap-3 px-1 sm:gap-4">
        <A
          href="/"
          style='font-feature-settings: "ss02"'
          class="relative flex h-9 shrink-0 items-center gap-1 rounded-md px-1.5 text-xl font-semibold hover:bg-neutral-200/60 active:bg-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
        >
          <img src="/pdsls-logo.svg" alt="" class="size-5" />
          <span>PDSls</span>
          <Show when={localStorage.getItem("hrt") === "true"}>
            <img
              src="/ribbon.webp"
              alt=""
              class="pointer-events-none absolute -top-2 -right-1 w-7 rotate-15"
            />
          </Show>
        </A>
        <Search />
        <div class="relative flex shrink-0 items-center">
          <AccountManager onCreateRecord={() => openCreateRecord?.()} />
        </div>
      </header>
      <Show when={agent()}>
        <RecordEditor
          create={true}
          scope="create"
          showTrigger={false}
          registerOpen={(open) => (openCreateRecord = open)}
        />
      </Show>
      <div class="flex w-full flex-col items-center gap-3 text-pretty">
        <Show when={props.params.pds && !props.params.spaceAuthority}>
          <NavBar />
        </Show>
        <ErrorBoundary
          fallback={(err, reset) => {
            createEffect(
              on(
                () => location.pathname,
                () => reset(),
                { defer: true },
              ),
            );
            return <div class="mt-3 wrap-anywhere">Error: {err.message}</div>;
          }}
        >
          <Suspense fallback={<Spinner />}>
            <Show
              when={
                !isRouting() ||
                location.pathname === stablePath ||
                stablePath.startsWith(location.pathname) ||
                location.pathname.startsWith(stablePath)
              }
              fallback={<Spinner />}
            >
              {props.children}
            </Show>
          </Suspense>
        </ErrorBoundary>
      </div>
      <NotificationContainer />
      <PermissionPromptContainer />
      <Show when={plcDirectory() !== "https://plc.directory"}>
        <div class="dark:bg-dark-500 fixed right-0 bottom-0 left-0 z-10 flex items-center justify-center bg-neutral-100 px-3 py-1 text-xs">
          <span>
            PLC directory: <span class="font-medium">{plcDirectory()}</span>
          </span>
        </div>
      </Show>
    </div>
  );
};

export { Layout };
