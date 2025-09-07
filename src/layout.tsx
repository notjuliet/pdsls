import { Handle } from "@atcute/lexicons";
import { Meta, MetaProvider } from "@solidjs/meta";
import { A, RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, ErrorBoundary, onMount, Show, Suspense } from "solid-js";
import { AccountManager } from "./components/account.jsx";
import { RecordEditor } from "./components/create.jsx";
import { DropdownMenu, MenuProvider, NavMenu } from "./components/dropdown.jsx";
import { agent } from "./components/login.jsx";
import { NavBar } from "./components/navbar.jsx";
import { Search, SearchButton, showSearch } from "./components/search.jsx";
import { themeEvent, ThemeSelection } from "./components/theme.jsx";
import { resolveHandle } from "./utils/api.js";

export const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 1;

export const [notif, setNotif] = createSignal<{
  show: boolean;
  icon?: string;
  text?: string;
}>({ show: false });

const Layout = (props: RouteSectionProps<unknown>) => {
  const location = useLocation();
  const navigate = useNavigate();
  let timeout: number;

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

  onMount(() => {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeEvent);
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
          class="flex items-center gap-1 rounded-lg px-1 text-xl font-semibold hover:bg-neutral-200 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"
        >
          <span class="iconify tabler--binary-tree-filled text-[#76c4e5]"></span>
          <span>PDSls</span>
        </A>
        <div class="relative flex items-center gap-1">
          <Show when={location.pathname !== "/"}>
            <SearchButton />
          </Show>
          <Show when={agent()}>
            <RecordEditor create={true} />
          </Show>
          <AccountManager />
          <MenuProvider>
            <DropdownMenu
              icon="lucide--menu text-xl"
              buttonClass="rounded-lg p-1"
              menuClass="top-8 p-3 text-sm"
            >
              <NavMenu href="/jetstream" label="Jetstream" icon="lucide--radio-tower" />
              <NavMenu href="/firehose" label="Firehose" icon="lucide--waves" />
              <NavMenu href="/settings" label="Settings" icon="lucide--settings" />
              <ThemeSelection />
            </DropdownMenu>
          </MenuProvider>
        </div>
      </header>
      <div class="flex max-w-full min-w-[22rem] flex-col items-center gap-4 text-pretty sm:min-w-[24rem] md:max-w-[48rem]">
        <Show when={showSearch() || location.pathname === "/"}>
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
          class="dark:shadow-dark-800 dark:bg-dark-100/70 fixed bottom-10 z-50 flex items-center rounded-lg border-[0.5px] border-neutral-300 bg-white/70 p-2 shadow-md backdrop-blur-xs dark:border-neutral-700"
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
