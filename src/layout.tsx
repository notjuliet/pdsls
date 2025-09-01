import { createEffect, createSignal, ErrorBoundary, onMount, Show, Suspense } from "solid-js";
import { A, RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { agent } from "./components/login.jsx";
import { RecordEditor } from "./components/create.jsx";
import { NavBar } from "./components/navbar.jsx";
import { Search } from "./components/search.jsx";
import { AccountManager } from "./components/account.jsx";
import { resolveHandle } from "./utils/api.js";
import { Meta, MetaProvider } from "@solidjs/meta";
import { Handle } from "@atcute/lexicons";
import { themeEvent, ThemeSelection } from "./components/theme.jsx";

export const [notif, setNotif] = createSignal<{
  show: boolean;
  icon?: string;
  text?: string;
}>({ show: false });

const Layout = (props: RouteSectionProps<unknown>) => {
  const location = useLocation();
  const navigate = useNavigate();
  let timeout: number;
  const [showMenu, setShowMenu] = createSignal(false);
  const [menu, setMenu] = createSignal<HTMLDivElement>();
  const [menuButton, setMenuButton] = createSignal<HTMLButtonElement>();

  createEffect(async () => {
    if (props.params.repo && !props.params.repo.startsWith("did:")) {
      const did = await resolveHandle(props.params.repo as Handle);
      navigate(location.pathname.replace(props.params.repo, did));
    }
  });

  createEffect(() => {
    if (notif().show) {
      clearTimeout(timeout);
      timeout = setTimeout(() => setNotif({ show: false }), 3000);
    }
  });

  const clickEvent = (event: MouseEvent) => {
    if (!menuButton()?.contains(event.target as Node) && !menu()?.contains(event.target as Node))
      setShowMenu(false);
  };

  onMount(() => {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeEvent);
    window.addEventListener("click", clickEvent);
  });

  return (
    <div id="main" class="m-4 flex flex-col items-center text-neutral-900 dark:text-neutral-200">
      <MetaProvider>
        <Show when={location.pathname !== "/"}>
          <Meta name="robots" content="noindex, nofollow" />
        </Show>
      </MetaProvider>
      <header class="mb-4 flex w-[22.5rem] items-center justify-between sm:w-[24.5rem]">
        <A
          href="/"
          style='font-feature-settings: "cv05"'
          class="flex items-center gap-1 rounded-lg px-1 text-lg font-bold hover:bg-neutral-200 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"
        >
          <span class="iconify tabler--binary-tree-filled text-[#76c4e5]"></span>
          <span>PDSls</span>
        </A>
        <div class="relative flex items-center gap-1">
          <Show when={agent()}>
            <RecordEditor create={true} />
          </Show>
          <AccountManager />
          <div class="relative">
            <button
              onClick={() => setShowMenu(!showMenu())}
              ref={setMenuButton}
              class="flex items-center rounded-lg p-1 hover:bg-neutral-200 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"
            >
              <span class="iconify lucide--menu text-xl"></span>
            </button>
            <Show when={showMenu()}>
              <div
                ref={setMenu}
                class="dark:bg-dark-300 absolute top-8 right-0 z-20 flex flex-col rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-3 text-sm shadow-md dark:border-neutral-700"
              >
                <A
                  href="/jetstream"
                  onClick={() => setShowMenu(false)}
                  class="rounded-lg p-1 hover:bg-neutral-200/50 active:bg-neutral-200/50 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"
                >
                  <span>Jetstream</span>
                </A>
                <A
                  href="/firehose"
                  onClick={() => setShowMenu(false)}
                  class="rounded-lg p-1 hover:bg-neutral-200/50 active:bg-neutral-200/50 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"
                >
                  <span>Firehose</span>
                </A>
                <A
                  href="/settings"
                  onClick={() => setShowMenu(false)}
                  class="rounded-lg p-1 hover:bg-neutral-200/50 active:bg-neutral-200/50 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"
                >
                  <span>Settings</span>
                </A>
                <ThemeSelection />
              </div>
            </Show>
          </div>
        </div>
      </header>
      <div class="dark:bg-dark-500 z-1 mb-4 flex max-w-full min-w-[22rem] flex-col items-center bg-neutral-100 text-pretty sm:min-w-[24rem] md:max-w-[48rem]">
        <Show when={!["/jetstream", "/firehose", "/settings"].includes(location.pathname)}>
          <Search />
        </Show>
        <Show when={props.params.pds}>
          <NavBar params={props.params} />
        </Show>
        <Show keyed when={location.pathname}>
          <ErrorBoundary
            fallback={(err) => <div class="mt-3 break-words">Error: {err.message}</div>}
          >
            <Suspense
              fallback={
                <span class="iconify lucide--loader-circle mt-3 animate-spin text-xl"></span>
              }
            >
              {props.children}
            </Suspense>
          </ErrorBoundary>
        </Show>
      </div>
      <Show when={notif().show}>
        <button
          class="dark:shadow-dark-900/80 dark:bg-dark-100/70 fixed bottom-10 z-50 flex items-center rounded-lg border-[0.5px] border-neutral-300 bg-white/70 p-2 shadow-md backdrop-blur-xs dark:border-neutral-700"
          onClick={() => setNotif({ show: false })}
        >
          <span class={`iconify ${notif().icon} mr-1`}></span>
          {notif().text}
        </button>
      </Show>
    </div>
  );
};

export { Layout };
