import { Handle } from "@atcute/lexicons";
import { Meta, MetaProvider, Title } from "@solidjs/meta";
import { A, RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, ErrorBoundary, onCleanup, onMount, Show, Suspense } from "solid-js";
import { AccountManager } from "./auth/account.jsx";
import { agent } from "./auth/state.js";
import { RecordEditor } from "./components/create";
import { DropdownMenu, MenuProvider, MenuSeparator, NavMenu } from "./components/dropdown.jsx";
import { NavBar } from "./components/navbar.jsx";
import { NotificationContainer } from "./components/notification.jsx";
import { PermissionPromptContainer } from "./components/permission-prompt.jsx";
import { Search, SearchButton } from "./components/search.jsx";
import { themeEvent } from "./components/theme.jsx";
import { resolveHandle } from "./utils/api.js";
import { plcDirectory } from "./views/settings.jsx";

export const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const headers: Record<string, string> = {
  "did:plc:ia76kvnndjutgedggx2ibrem": "bunny.jpg",
  "did:plc:oisofpd7lj26yvgiivf3lxsi": "puppy.jpg",
  "did:plc:vwzwgnygau7ed7b7wt5ux7y2": "water.webp",
  "did:plc:uu5axsmbm2or2dngy4gwchec": "city.webp",
  "did:plc:ucaezectmpny7l42baeyooxi": "almaty.webp",
  "did:plc:355lbopbpckczt672hss2ra4": "kit.jpg",
  "did:plc:q6ywj35eew5f3cdajho7bmq7": "dreary.jpg",
};

const Layout = (props: RouteSectionProps<unknown>) => {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.search.includes("hrt=true")) localStorage.setItem("hrt", "true");
  else if (location.search.includes("hrt=false")) localStorage.setItem("hrt", "false");
  if (location.search.includes("sailor=true")) localStorage.setItem("sailor", "true");
  else if (location.search.includes("sailor=false")) localStorage.setItem("sailor", "false");

  createEffect(async () => {
    if (props.params.repo && !props.params.repo.startsWith("did:")) {
      const did = await resolveHandle(props.params.repo as Handle);
      navigate(location.pathname.replace(props.params.repo, did), { replace: true });
    }
  });

  onMount(() => {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeEvent);

    const handleGoToRepo = (ev: KeyboardEvent) => {
      if (document.querySelector("[data-modal]")) return;
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;

      if (ev.key === "g" && agent()?.sub) {
        ev.preventDefault();
        navigate(`/at://${agent()!.sub}`);
      }
    };

    window.addEventListener("keydown", handleGoToRepo);
    onCleanup(() => window.removeEventListener("keydown", handleGoToRepo));

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
    <MetaProvider>
      <Title>PDSls</Title>
      <Show when={location.pathname !== "/"}>
        <Meta name="robots" content="noindex, nofollow" />
      </Show>
      <div id="main" class="mx-auto mb-8 flex max-w-lg flex-col items-center p-3">
        <header
          class={`dark:shadow-dark-700 mb-3 flex h-13 w-full items-center justify-between rounded-xl border-[0.5px] border-neutral-300 bg-neutral-50 bg-size-[95%] bg-right bg-no-repeat p-2 pl-3 shadow-xs [--header-bg:#fafafa] [--trans-blue:#5BCEFA90] [--trans-pink:#F5A9B890] [--trans-white:#FFFFFF90] dark:border-neutral-700 dark:bg-neutral-800 dark:[--header-bg:#262626] dark:[--trans-blue:#5BCEFAa0] dark:[--trans-pink:#F5A9B8a0] dark:[--trans-white:#FFFFFFa0] ${localStorage.getItem("hrt") === "true" ? "bg-[linear-gradient(to_left,transparent_10%,var(--header-bg)_85%),linear-gradient(to_bottom,var(--trans-blue)_0%,var(--trans-blue)_20%,var(--trans-pink)_20%,var(--trans-pink)_40%,var(--trans-white)_40%,var(--trans-white)_60%,var(--trans-pink)_60%,var(--trans-pink)_80%,var(--trans-blue)_80%,var(--trans-blue)_100%)]" : ""}`}
          style={{
            "background-image":
              props.params.repo && props.params.repo in headers ?
                `linear-gradient(to left, transparent 20%, var(--header-bg) 85%), url(/headers/${headers[props.params.repo]})`
              : undefined,
          }}
        >
          <A
            href="/"
            style='font-feature-settings: "cv05"'
            class="relative flex items-center gap-1 text-xl font-semibold"
          >
            <span class="iconify tabler--binary-tree-filled text-[#76c4e5]"></span>
            <span>PDSls</span>
            <Show when={localStorage.getItem("hrt") === "true"}>
              <img
                src="/ribbon.webp"
                alt=""
                class="pointer-events-none absolute -top-3 -right-4 w-8 rotate-15"
              />
            </Show>
          </A>
          <div class="relative flex items-center gap-0.5 rounded-lg bg-neutral-50/60 p-1 dark:bg-neutral-800/60">
            <div class="mr-1">
              <SearchButton />
            </div>
            <Show when={agent()}>
              <RecordEditor create={true} scope="create" />
            </Show>
            <AccountManager />
            <MenuProvider>
              <DropdownMenu icon="lucide--menu text-lg" buttonClass="rounded-md p-1.5">
                <NavMenu href="/jetstream" label="Jetstream" icon="lucide--radio-tower" />
                <NavMenu href="/firehose" label="Firehose" icon="lucide--rss" />
                <NavMenu href="/spacedust" label="Spacedust" icon="lucide--sparkles" />
                <MenuSeparator />
                <NavMenu href="/labels" label="Labels" icon="lucide--tag" />
                <NavMenu href="/car" label="Archive tools" icon="lucide--folder-archive" />
                <MenuSeparator />
                <NavMenu href="/settings" label="Settings" icon="lucide--settings" />
              </DropdownMenu>
            </MenuProvider>
          </div>
        </header>
        <div class="flex w-full flex-col items-center gap-3 text-pretty">
          <Search />
          <Show when={props.params.pds}>
            <NavBar params={props.params} />
          </Show>
          <Show keyed when={location.pathname}>
            <ErrorBoundary
              fallback={(err) => <div class="mt-3 wrap-anywhere">Error: {err.message}</div>}
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
    </MetaProvider>
  );
};

export { Layout };
