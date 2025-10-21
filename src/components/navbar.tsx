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
    <nav class="flex w-full flex-col text-sm wrap-anywhere sm:text-base">
      {/* PDS Level */}
      <div class="group relative flex items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent px-2 py-0.5 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
        <div class="flex min-h-5 basis-full items-center gap-1.5 sm:min-h-6">
          <Tooltip text="PDS">
            <span class="iconify lucide--hard-drive shrink-0 text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"></span>
          </Tooltip>
          <Show when={pds()}>
            <Show when={props.params.repo} fallback={<span class="font-medium">{pds()}</span>}>
              <A
                end
                href={pds()!}
                inactiveClass="text-blue-400 w-full font-medium hover:text-blue-500 transition-colors duration-150 dark:hover:text-blue-300"
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
              buttonClass="rounded p-1 text-base transition-all duration-200 hover:bg-neutral-200/70 active:bg-neutral-300/70 dark:hover:bg-neutral-700/70 dark:active:bg-neutral-600/70"
              menuClass="top-7 p-2 text-xs"
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

      <div class="flex flex-col">
        <Show when={props.params.repo}>
          {/* Repository Level */}
          <div class="group relative flex items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent px-2 py-0.5 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <div class="flex basis-full items-center gap-1.5">
              <Tooltip text="Repository">
                <span class="iconify lucide--book-user text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"></span>
              </Tooltip>
              {props.params.collection || location.pathname.includes("/labels") ?
                <A
                  end
                  href={`/at://${props.params.repo}`}
                  inactiveClass="text-blue-400 w-full font-medium hover:text-blue-500 transition-colors duration-150 dark:hover:text-blue-300"
                >
                  {showHandle() ? handle() : props.params.repo}
                </A>
              : <span class="font-medium">{showHandle() ? handle() : props.params.repo}</span>}
            </div>
            <Tooltip text={showHandle() ? "Show DID" : "Show handle"}>
              <button
                class="flex items-center rounded p-1 text-base transition-all duration-200 hover:bg-neutral-200/70 active:bg-neutral-300/70 dark:hover:bg-neutral-700/70 dark:active:bg-neutral-600/70"
                onclick={() => {
                  localStorage.showHandle = !showHandle();
                  setShowHandle(!showHandle());
                }}
              >
                <span
                  class={`iconify shrink-0 transition-transform duration-300 ease-in-out ${showHandle() ? "rotate-y-180" : ""} lucide--arrow-left-right`}
                ></span>
              </button>
            </Tooltip>
          </div>
        </Show>

        {/* Labels Level */}
        <Show
          when={
            !props.params.collection &&
            (props.params.repo in labelerCache || location.pathname.endsWith("/labels"))
          }
        >
          <div class="group flex items-center gap-1.5 rounded-md border-[0.5px] border-transparent bg-transparent px-2 py-0.5 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <span class="iconify lucide--tag text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"></span>
            <A
              end
              href={`/at://${props.params.repo}/labels`}
              inactiveClass="text-blue-400 grow font-medium hover:text-blue-500 transition-colors duration-150 dark:hover:text-blue-300"
            >
              labels
            </A>
          </div>
        </Show>

        {/* Collection Level */}
        <Show when={props.params.collection}>
          <div class="group flex items-center gap-1.5 rounded-md border-[0.5px] border-transparent bg-transparent px-2 py-0.5 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <Tooltip text="Collection">
              <span class="iconify lucide--folder-open text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"></span>
            </Tooltip>
            <Show
              when={props.params.rkey}
              fallback={<span class="font-medium">{props.params.collection}</span>}
            >
              <A
                end
                href={`/at://${props.params.repo}/${props.params.collection}`}
                inactiveClass="text-blue-400 grow font-medium hover:text-blue-500 transition-colors duration-150 dark:hover:text-blue-300"
              >
                {props.params.collection}
              </A>
            </Show>
          </div>
        </Show>

        {/* Record Level */}
        <Show when={props.params.rkey}>
          <div class="group flex items-center gap-1.5 rounded-md border-[0.5px] border-transparent bg-transparent px-2 py-0.5 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <Tooltip text="Record">
              <span class="iconify lucide--file-json text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"></span>
            </Tooltip>
            <span class="font-medium">{props.params.rkey}</span>
          </div>
        </Show>
      </div>
    </nav>
  );
};
