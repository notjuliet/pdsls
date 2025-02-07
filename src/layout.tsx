import { createSignal, ErrorBoundary, onMount, Show, Suspense } from "solid-js";
import { RouteSectionProps, useLocation, useParams } from "@solidjs/router";
import { agent, loginState, retrieveSession } from "./components/login.jsx";
import { CreateRecord } from "./components/create.jsx";
import Tooltip from "./components/tooltip.jsx";
import { NavBar } from "./components/navbar.jsx";
import { Search } from "./components/search.jsx";
import { AccountManager } from "./components/account.jsx";
import { resolveHandle } from "./utils/api.js";

export const [theme, setTheme] = createSignal(
  (
    localStorage.theme === "dark" ||
      (!("theme" in localStorage) &&
        globalThis.matchMedia("(prefers-color-scheme: dark)").matches)
  ) ?
    "dark"
  : "light",
);

const Layout = (props: RouteSectionProps<unknown>) => {
  try {
    navigator.registerProtocolHandler("web+at", "/%s");
    const pathname = decodeURIComponent(useLocation().pathname);
    if (pathname.startsWith("/web+at://")) {
      window.location.href = pathname.replace("web+at://", "at/");
    }
  } catch (err) {
    console.error(err);
  }
  const params = useParams();
  const location = useLocation();
  onMount(async () => {
    if (params.repo && !params.repo.startsWith("did:")) {
      const did = await resolveHandle(params.repo);
      window.location.href = location.pathname.replace(params.repo, did);
    }
    await retrieveSession();
    if (loginState() && location.pathname === "/")
      window.location.href = `/at/${agent.sub}`;
  });

  return (
    <div
      id="main"
      class="m-5 flex flex-col items-center text-slate-900 dark:text-slate-100"
    >
      <div class="mb-2 flex w-[21rem] items-center">
        <div class="flex basis-1/4 gap-x-2">
          <div
            class="w-fit cursor-pointer"
            onclick={() => {
              setTheme(theme() === "light" ? "dark" : "light");
              if (theme() === "dark")
                document.documentElement.classList.add("dark");
              else document.documentElement.classList.remove("dark");
              localStorage.theme = theme();
            }}
          >
            <Tooltip text="Theme">
              {theme() === "dark" ?
                <div class="i-tabler-moon-stars text-xl" />
              : <div class="i-tabler-sun text-xl" />}
            </Tooltip>
          </div>
          <AccountManager />
          <Show when={loginState()}>
            <CreateRecord />
          </Show>
        </div>
        <div class="basis-1/2 text-center font-mono text-xl font-bold">
          <a href="/" class="hover:underline">
            PDSls
          </a>{" "}
          <a
            href="https://links.bsky.bad-example.com"
            class="hover:underline"
            title="PDSls with backlinks from Constellation"
            target="_blank"
          >
            -l🌌
          </a>
        </div>
        <div class="justify-right flex basis-1/4 items-center gap-x-2">
          <a href="https://github.com/at-ucosm/pdsls" target="_blank">
            <Tooltip text="GitHub">
              <div class="i-bi-github text-xl" />
            </Tooltip>
          </a>
          <a href="https://ko-fi.com/notjuliet" target="_blank">
            <Tooltip text="Donate">
              <div class="i-simple-icons-kofi text-xl" />
            </Tooltip>
          </a>
        </div>
      </div>
      <div class="mb-5 flex max-w-full flex-col items-center text-pretty md:max-w-screen-md">
        <Show when={location.pathname !== "/login"}>
          <Search />
        </Show>
        <Show when={params.pds}>
          <NavBar params={params} />
        </Show>
        <Show keyed when={location.pathname}>
          <ErrorBoundary
            fallback={(err) => (
              <div class="mt-3 break-words">Error: {err.message}</div>
            )}
          >
            <Suspense
              fallback={
                <div class="i-line-md-loading-twotone-loop mt-3 text-xl" />
              }
            >
              {props.children}
            </Suspense>
          </ErrorBoundary>
        </Show>
      </div>
    </div>
  );
};

export { Layout };
