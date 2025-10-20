import { A, Params, useLocation } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";
import { didDocCache, labelerCache } from "../utils/api";
import { CopyMenu, DropdownMenu, MenuProvider } from "./dropdown";
import Tooltip from "./tooltip";

export const [pds, setPDS] = createSignal<string>();

export const NavBar = (props: { params: Params }) => {
  const location = useLocation();
  const [handle, setHandle] = createSignal(props.params.repo);
  const [showHandle, setShowHandle] = createSignal(localStorage.showHandle === "true");

  createEffect(() => {
    if (pds() !== undefined && props.params.repo) {
      const hdl =
        didDocCache[props.params.repo]?.alsoKnownAs
          ?.filter((alias) => alias.startsWith("at://"))[0]
          .split("at://")[1] ?? props.params.repo;
      if (hdl !== handle()) setHandle(hdl);
    }
  });

  return (
    <nav class="flex w-full flex-col px-2 text-sm wrap-anywhere sm:text-base">
      <div class="relative flex items-center justify-between gap-1">
        <div class="flex min-h-[1.25rem] basis-full items-center gap-2 sm:min-h-[1.5rem]">
          <Tooltip text="PDS">
            <span class="iconify lucide--hard-drive shrink-0"></span>
          </Tooltip>
          <Show when={pds()}>
            <Show when={props.params.repo} fallback={<span>{pds()}</span>}>
              <A
                end
                href={pds()!}
                inactiveClass="text-blue-400 w-full hover:underline active:underline"
              >
                {pds()}
              </A>
            </Show>
          </Show>
        </div>
        <Show when={props.params.repo}>
          <MenuProvider>
            <DropdownMenu
              icon="lucide--copy"
              buttonClass="rounded p-0.5 sm:p-1 text-base"
              menuClass="top-6 p-2 text-xs"
            >
              <Show when={pds()}>
                <CopyMenu copyContent={pds()!} label="Copy PDS" />
              </Show>
              <CopyMenu copyContent={props.params.repo} label="Copy DID" />
              <CopyMenu
                copyContent={`at://${props.params.repo}${props.params.collection ? `/${props.params.collection}` : ""}${props.params.rkey ? `/${props.params.rkey}` : ""}`}
                label="Copy AT URI"
              />
            </DropdownMenu>
          </MenuProvider>
        </Show>
      </div>
      <div class="flex flex-col flex-wrap">
        <Show when={props.params.repo}>
          <div class="relative flex items-center justify-between gap-1">
            <div class="flex basis-full items-center gap-2">
              <Tooltip text="Repository">
                <span class="iconify lucide--book-user"></span>
              </Tooltip>
              {props.params.collection || location.pathname.includes("/labels") ?
                <A
                  end
                  href={`/at://${props.params.repo}`}
                  inactiveClass="text-blue-400 hover:underline active:underline w-full"
                >
                  {showHandle() ? handle() : props.params.repo}
                </A>
              : <span>{showHandle() ? handle() : props.params.repo}</span>}
            </div>
            <Tooltip text={showHandle() ? "Show DID" : "Show handle"}>
              <button
                class="flex items-center rounded p-0.5 text-base hover:bg-neutral-200 active:bg-neutral-300 sm:p-1 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                onclick={() => {
                  localStorage.showHandle = !showHandle();
                  setShowHandle(!showHandle());
                }}
              >
                <span
                  class={`iconify shrink-0 transition-transform duration-400 ${showHandle() ? "rotate-y-180" : ""} lucide--arrow-left-right`}
                ></span>
              </button>
            </Tooltip>
          </div>
        </Show>
        <Show
          when={
            !props.params.collection &&
            (props.params.repo in labelerCache || location.pathname.endsWith("/labels"))
          }
        >
          <div class="flex items-center gap-2">
            <span class="iconify lucide--tag"></span>
            <A
              end
              href={`/at://${props.params.repo}/labels`}
              inactiveClass="text-blue-400 grow hover:underline active:underline"
            >
              labels
            </A>
          </div>
        </Show>
        <Show when={props.params.collection}>
          <div class="flex items-center gap-2">
            <Tooltip text="Collection">
              <span class="iconify lucide--folder-open"></span>
            </Tooltip>
            <Show when={props.params.rkey} fallback={<span>{props.params.collection}</span>}>
              <A
                end
                href={`/at://${props.params.repo}/${props.params.collection}`}
                inactiveClass="text-blue-400 w-full hover:underline active:underline"
              >
                {props.params.collection}
              </A>
            </Show>
          </div>
        </Show>
        <Show when={props.params.rkey}>
          <div class="flex items-center gap-2">
            <Tooltip text="Record">
              <span class="iconify lucide--file-json"></span>
            </Tooltip>
            <span>{props.params.rkey}</span>
          </div>
        </Show>
      </div>
    </nav>
  );
};
