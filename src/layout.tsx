import { Handle } from "@atcute/lexicons";
import { Meta, MetaProvider } from "@solidjs/meta";
import { A, RouteSectionProps, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, ErrorBoundary, onCleanup, onMount, Show, Suspense } from "solid-js";
import { AccountManager } from "./auth/account.jsx";
import { hasUserScope } from "./auth/scope-utils";
import { agent } from "./auth/state.js";
import { RecordEditor } from "./components/create";
import { DropdownMenu, MenuProvider, MenuSeparator, NavMenu } from "./components/dropdown.jsx";
import { NavBar } from "./components/navbar.jsx";
import { NotificationContainer } from "./components/notification.jsx";
import { Search, SearchButton, showSearch } from "./components/search.jsx";
import { themeEvent } from "./components/theme.jsx";
import { resolveHandle } from "./utils/api.js";

export const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 1;

const headers: Record<string, string> = {
  "did:plc:ia76kvnndjutgedggx2ibrem": "bunny.jpg",
  "did:plc:oisofpd7lj26yvgiivf3lxsi": "puppy.jpg",
  "did:plc:vwzwgnygau7ed7b7wt5ux7y2": "water.webp",
  "did:plc:uu5axsmbm2or2dngy4gwchec": "city.webp",
  "did:plc:aokggmp5jzj4nc5jifhiplqc": "bridge.jpg",
  "did:plc:bnqkww7bjxaacajzvu5gswdf": "forest.jpg",
  "did:plc:p2cp5gopk7mgjegy6wadk3ep": "aurora.jpg",
  "did:plc:ucaezectmpny7l42baeyooxi": "almaty.webp",
  "did:plc:7rfssi44thh6f4ywcl3u5nvt": "sonic.jpg",
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
    <div id="main" class="mx-auto mb-8 flex max-w-lg flex-col items-center p-3">
      <MetaProvider>
        <Show when={location.pathname !== "/"}>
          <Meta name="robots" content="noindex, nofollow" />
        </Show>
      </MetaProvider>
      <header
        class={`dark:shadow-dark-700 mb-3 flex w-full items-center justify-between rounded-xl border-[0.5px] border-neutral-300 bg-neutral-50 bg-size-[95%] bg-right bg-no-repeat p-2 pl-3 shadow-xs [--header-bg:#fafafa] dark:border-neutral-700 dark:bg-neutral-800 dark:[--header-bg:#262626] ${localStorage.getItem("hrt") === "true" ? "bg-[linear-gradient(to_left,transparent_10%,var(--header-bg)_85%),linear-gradient(to_bottom,#5BCEFA90_0%,#5BCEFA90_20%,#F5A9B890_20%,#F5A9B890_40%,#FFFFFF90_40%,#FFFFFF90_60%,#F5A9B890_60%,#F5A9B890_80%,#5BCEFA90_80%,#5BCEFA90_100%)]" : ""}`}
        style={{
          "background-image":
            props.params.repo && props.params.repo in headers ?
              `linear-gradient(to left, transparent 10%, var(--header-bg) 85%), url(/headers/${headers[props.params.repo]})`
            : undefined,
        }}
      >
        <A
          href="/"
          style='font-feature-settings: "cv05"'
          class="flex items-center gap-1 text-xl font-semibold"
        >
          <span class="iconify tabler--binary-tree-filled text-[#76c4e5]"></span>
          <span>PDSls</span>
        </A>
        <div class="relative flex items-center gap-0.5 rounded-lg bg-neutral-50/60 px-1 py-0.5 dark:bg-neutral-800/60">
          <SearchButton />
          <Show when={hasUserScope("create")}>
            <RecordEditor create={true} />
          </Show>
          <AccountManager />
          <MenuProvider>
            <DropdownMenu icon="lucide--menu text-lg" buttonClass="rounded-lg p-1.5">
              <NavMenu href="/jetstream" label="Jetstream" icon="lucide--radio-tower" />
              <NavMenu href="/firehose" label="Firehose" icon="lucide--droplet" />
              <NavMenu href="/labels" label="Labels" icon="lucide--tag" />
              <NavMenu href="/settings" label="Settings" icon="lucide--settings" />
              <MenuSeparator />
              <NavMenu
                href="https://bsky.app/profile/did:plc:6q5daed5gutiyerimlrnojnz"
                label="Bluesky"
                icon="simple-icons--bluesky text-[#0085ff]"
                newTab
              />
              <NavMenu
                href="https://tangled.org/@pdsls.dev/pdsls/"
                label="Source"
                icon="lucide--code"
                newTab
              />
            </DropdownMenu>
          </MenuProvider>
        </div>
      </header>
      <div class="flex w-full flex-col items-center gap-3 text-pretty">
        <Show when={showSearch() || location.pathname === "/"}>
          <Search />
        </Show>
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
      <Show
        when={localStorage.plcDirectory && localStorage.plcDirectory !== "https://plc.directory"}
      >
        <div class="dark:bg-dark-500 fixed right-0 bottom-0 left-0 z-10 flex items-center justify-center bg-neutral-100 px-3 py-1 text-xs">
          <span>
            PLC directory: <span class="font-medium">{localStorage.plcDirectory}</span>
          </span>
        </div>
      </Show>
    </div>
  );
};

export { Layout };
