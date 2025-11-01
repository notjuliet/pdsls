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

const headers: Record<string, string> = {
  "did:plc:ia76kvnndjutgedggx2ibrem": "bunny.jpg",
  "did:plc:oisofpd7lj26yvgiivf3lxsi": "puppy.jpg",
  "did:plc:vwzwgnygau7ed7b7wt5ux7y2": "water.webp",
  "did:plc:uu5axsmbm2or2dngy4gwchec": "city.webp",
  "did:plc:aokggmp5jzj4nc5jifhiplqc": "bridge.jpg",
  "did:plc:bnqkww7bjxaacajzvu5gswdf": "forest.jpg",
  "did:plc:p2cp5gopk7mgjegy6wadk3ep": "aurora.jpg",
  "did:plc:ucaezectmpny7l42baeyooxi": "almaty.webp",
};

const Layout = (props: RouteSectionProps<unknown>) => {
  const location = useLocation();
  const navigate = useNavigate();
  let timeout: number;

  if (location.search.includes("hrt=true")) localStorage.setItem("hrt", "true");
  else if (location.search.includes("hrt=false")) localStorage.setItem("hrt", "false");
  if (location.search.includes("sailor=true")) localStorage.setItem("sailor", "true");
  else if (location.search.includes("sailor=false")) localStorage.setItem("sailor", "false");

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
    <div
      id="main"
      class="mx-auto mb-8 flex max-w-lg flex-col items-center p-4 text-neutral-900 dark:text-neutral-200"
    >
      <MetaProvider>
        <Show when={location.pathname !== "/"}>
          <Meta name="robots" content="noindex, nofollow" />
        </Show>
      </MetaProvider>
      <header
        class={`dark:shadow-dark-700 dark:bg-dark-300 mb-3 flex w-full items-center justify-between rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 bg-size-[95%] bg-right bg-no-repeat p-3 shadow-xs [--header-bg:#fafafa] dark:border-neutral-700 dark:[--header-bg:#2d2d2d] ${localStorage.getItem("hrt") === "true" ? "bg-[linear-gradient(to_left,transparent_10%,var(--header-bg)_85%),linear-gradient(to_bottom,#5BCEFA90_0%,#5BCEFA90_20%,#F5A9B890_20%,#F5A9B890_40%,#FFFFFF90_40%,#FFFFFF90_60%,#F5A9B890_60%,#F5A9B890_80%,#5BCEFA90_80%,#5BCEFA90_100%)]" : ""}`}
        style={{
          "background-image":
            props.params.repo in headers ?
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
        <div class="dark:bg-dark-300/60 relative flex items-center gap-1 rounded-lg bg-neutral-50/60">
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
              menuClass="top-10 p-3 text-sm"
            >
              <NavMenu href="/jetstream" label="Jetstream" />
              <NavMenu href="/firehose" label="Firehose" />
              <NavMenu href="/settings" label="Settings" />
              <NavMenu
                href="https://bsky.app/profile/did:plc:6q5daed5gutiyerimlrnojnz"
                label="Bluesky"
                newTab
                external
              />
              <NavMenu
                href="https://tangled.org/@pdsls.dev/pdsls/"
                label="Source"
                newTab
                external
              />
              <ThemeSelection />
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
            fallback={(err) => <div class="mt-3 wrap-break-word">Error: {err.message}</div>}
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
          class="dark:shadow-dark-700 dark:bg-dark-100 fixed bottom-10 z-50 flex items-center rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 shadow-md dark:border-neutral-700"
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
