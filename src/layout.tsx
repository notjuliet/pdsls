import { createEffect, createSignal, ErrorBoundary, Show, Suspense } from "solid-js";
import { A, RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { agent } from "./components/login.jsx";
import { RecordEditor } from "./components/create.jsx";
import Tooltip from "./components/tooltip.jsx";
import { NavBar } from "./components/navbar.jsx";
import { Search } from "./components/search.jsx";
import { AccountManager } from "./components/account.jsx";
import { resolveHandle } from "./utils/api.js";
import { Meta, MetaProvider } from "@solidjs/meta";
import { Settings } from "./components/settings.jsx";
import { Handle } from "@atcute/lexicons";

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

  return (
    <div id="main" class="m-4 flex flex-col items-center text-neutral-900 dark:text-neutral-200">
      <MetaProvider>
        <Show when={location.pathname !== "/"}>
          <Meta name="robots" content="noindex, nofollow" />
        </Show>
      </MetaProvider>
      <header class="mb-4 flex w-[22rem] items-center sm:w-[24rem]">
        <div class="flex basis-1/3 gap-x-2">
          <Tooltip text="Relay">
            <A href="/jetstream" class="iconify lucide--radio-tower text-xl"></A>
          </Tooltip>
        </div>
        <div class="flex basis-1/3 justify-center">
          <A
            href="/"
            style='font-feature-settings: "cv05"'
            class="flex items-center gap-1 rounded-lg px-1 font-bold hover:bg-neutral-200 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"
          >
            <span class="iconify tabler--binary-tree-filled text-[#76c4e5]"></span>
            <span>PDSls</span>
          </A>
        </div>
        <div class="flex basis-1/3 items-center justify-end gap-x-2">
          <Show when={agent()}>
            <RecordEditor create={true} />
          </Show>
          <AccountManager />
          <Settings />
        </div>
      </header>
      <div class="dark:bg-dark-500 z-1 mb-4 flex max-w-full min-w-[22rem] flex-col items-center bg-neutral-100 text-pretty sm:min-w-[24rem] md:max-w-[48rem]">
        <Show when={location.pathname !== "/jetstream" && location.pathname !== "/firehose"}>
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
