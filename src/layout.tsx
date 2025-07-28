import { createEffect, ErrorBoundary, onMount, Show, Suspense } from "solid-js";
import { A, RouteSectionProps, useLocation, useParams } from "@solidjs/router";
import { agent, loginState, retrieveSession } from "./components/login.jsx";
import { RecordEditor } from "./components/create.jsx";
import Tooltip from "./components/tooltip.jsx";
import { NavBar } from "./components/navbar.jsx";
import { Search } from "./components/search.jsx";
import { AccountManager } from "./components/account.jsx";
import { resolveHandle } from "./utils/api.js";
import { Meta, MetaProvider } from "@solidjs/meta";
import { kawaii, Settings } from "./components/settings.jsx";
import { Handle } from "@atcute/lexicons";
import { copyNotice } from "./utils/copy.js";

const Layout = (props: RouteSectionProps<unknown>) => {
  const params = useParams();
  const location = useLocation();

  onMount(async () => {
    if (location.search.includes("kawaii=true")) localStorage.kawaii = "true";
    await retrieveSession();
    if (loginState() && location.pathname === "/") window.location.href = `/at://${agent.sub}`;
  });

  createEffect(async () => {
    if (params.repo && !params.repo.startsWith("did:")) {
      const did = await resolveHandle(params.repo as Handle);
      window.location.replace(location.pathname.replace(params.repo, did));
    }
  });

  return (
    <div id="main" class="m-4 flex flex-col items-center text-slate-900 dark:text-slate-100">
      <Show when={location.pathname !== "/"}>
        <MetaProvider>
          <Meta name="robots" content="noindex, nofollow" />
        </MetaProvider>
      </Show>
      <div class="mb-2 flex w-[21rem] items-center sm:w-[23rem]">
        <div class="flex basis-1/3 gap-x-2">
          <A href="/jetstream">
            <Tooltip text="Relay">
              <div class="i-lucide-radio-tower text-xl" />
            </Tooltip>
          </A>
          <AccountManager />
        </div>
        <div class="flex basis-1/3 items-center justify-center text-center">
          <A href="/" class="font-mono font-bold hover:underline">
            PDSls
          </A>
          <Show when={location.search.includes("kawaii=true") || kawaii()}>
            <a
              href="https://bsky.app/profile/ninikyuu.bsky.social/post/3l3tq5xwqf22o"
              target="_blank"
              class="h-25px sm:fixed sm:bottom-4 sm:left-0 sm:h-auto"
            >
              <img
                src="/bluetan.png"
                title="Art by nico ღ (ninikyuu.bsky.social)"
                class="w-45px sm:w-150px md:w-200px z-0"
              />
            </a>
          </Show>
        </div>
        <div class="justify-right flex basis-1/3 items-center gap-x-2">
          <Show when={loginState()}>
            <RecordEditor create={true} />
          </Show>
          <Settings />
        </div>
      </div>
      <div class="min-w-21rem sm:min-w-23rem z-1 dark:bg-dark-500 mb-4 flex max-w-full flex-col items-center text-pretty bg-zinc-100 md:max-w-screen-md">
        <Show when={location.pathname !== "/jetstream" && location.pathname !== "/firehose"}>
          <Search />
        </Show>
        <Show when={params.pds}>
          <NavBar params={params} />
        </Show>
        <Show keyed when={location.pathname}>
          <ErrorBoundary
            fallback={(err) => (
              <div class="mt-3 break-words text-red-500 dark:text-red-400">
                Error: {err.message}
              </div>
            )}
          >
            <Suspense fallback={<div class="i-lucide-loader-circle mt-3 animate-spin text-xl" />}>
              {props.children}
            </Suspense>
          </ErrorBoundary>
        </Show>
      </div>
      <Show when={copyNotice()}>
        <div class="dark:bg-dark-100 dark:shadow-dark-900 fixed bottom-8 z-10 flex items-center rounded-md bg-neutral-200 p-2 shadow-md">
          <div class="i-lucide-clipboard-check mr-1 text-xl" />
          Copied to clipboard
        </div>
      </Show>
    </div>
  );
};

export { Layout };
