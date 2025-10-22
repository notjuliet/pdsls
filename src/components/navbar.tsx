import { A, Params, useLocation } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";
import { didDocCache, labelerCache } from "../utils/api";
import { addToClipboard } from "../utils/copy";
import Tooltip from "./tooltip";

export const [pds, setPDS] = createSignal<string>();

const CopyButton = (props: { content: string }) => {
  return (
    <button
      type="button"
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addToClipboard(props.content);
      }}
      class={`-mr-2 hidden items-center rounded px-2 py-1.5 text-neutral-500 transition-all duration-200 group-hover:flex hover:bg-neutral-200/70 hover:text-neutral-600 active:bg-neutral-300/70 dark:text-neutral-400 dark:hover:bg-neutral-700/70 dark:hover:text-neutral-300 dark:active:bg-neutral-600/70`}
      aria-label="Copy to clipboard"
    >
      <span class="iconify lucide--link"></span>
    </button>
  );
};

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
    <nav class="flex w-full flex-col wrap-anywhere">
      {/* PDS Level */}
      <div class="group relative flex items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
        <div class="flex min-h-7 basis-full items-center gap-2">
          <Tooltip text="PDS">
            <span class="iconify lucide--hard-drive shrink-0 text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"></span>
          </Tooltip>
          <Show when={pds()}>
            <Show
              when={props.params.repo}
              fallback={<span class="py-0.5 font-medium">{pds()}</span>}
            >
              <A
                end
                href={pds()!}
                inactiveClass="text-blue-400 py-0.5 w-full font-medium hover:text-blue-500 transition-colors duration-150 dark:hover:text-blue-300"
              >
                {pds()}
              </A>
            </Show>
          </Show>
        </div>
        <Show when={pds()}>
          <CopyButton content={pds()!} />
        </Show>
      </div>

      <div class="flex flex-col">
        <Show when={props.params.repo}>
          {/* Repository Level */}
          <div class="group relative flex items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <div class="-ml-2 flex basis-full items-center">
              <Tooltip text={showHandle() ? "Show DID" : "Show handle"}>
                <button
                  type="button"
                  class="relative flex items-center rounded px-2 py-1.5 text-neutral-500 transition-all duration-200 hover:bg-neutral-200/70 hover:text-neutral-700 active:bg-neutral-300/70 dark:text-neutral-400 dark:hover:bg-neutral-700/70 dark:hover:text-neutral-200 dark:active:bg-neutral-600/70"
                  onclick={() => {
                    localStorage.showHandle = !showHandle();
                    setShowHandle(!showHandle());
                  }}
                  aria-label="Switch DID/Handle"
                >
                  <span class="iconify lucide--book-user shrink-0 transition-opacity duration-200 group-hover:opacity-0"></span>
                  <span
                    class={`iconify absolute shrink-0 opacity-0 transition-all duration-200 group-hover:opacity-100 ${showHandle() ? "rotate-y-180" : ""} lucide--arrow-left-right`}
                  ></span>
                </button>
              </Tooltip>
              {props.params.collection || location.pathname.includes("/labels") ?
                <A
                  end
                  href={`/at://${props.params.repo}`}
                  inactiveClass="text-blue-400 w-full py-0.5 font-medium hover:text-blue-500 transition-colors duration-150 dark:hover:text-blue-300"
                >
                  {showHandle() ? handle() : props.params.repo}
                </A>
              : <span class="py-0.5 font-medium">
                  {showHandle() ? handle() : props.params.repo}
                </span>
              }
            </div>
            <CopyButton content={props.params.repo} />
          </div>
        </Show>

        {/* Labels Level */}
        <Show
          when={
            !props.params.collection &&
            (props.params.repo in labelerCache || location.pathname.endsWith("/labels"))
          }
        >
          <div class="group flex items-center justify-between gap-2 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <div class="flex basis-full items-center gap-2">
              <span class="iconify lucide--tag text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"></span>
              <A
                end
                href={`/at://${props.params.repo}/labels`}
                class="py-0.5"
                inactiveClass="text-blue-400 grow font-medium hover:text-blue-500 transition-colors duration-150 dark:hover:text-blue-300"
              >
                labels
              </A>
            </div>
            <CopyButton content={`at://${props.params.repo}/labels`} />
          </div>
        </Show>

        {/* Collection Level */}
        <Show when={props.params.collection}>
          <div class="group flex items-center justify-between gap-2 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <div class="flex basis-full items-center gap-2">
              <Tooltip text="Collection">
                <span class="iconify lucide--folder-open text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"></span>
              </Tooltip>
              <Show
                when={props.params.rkey}
                fallback={<span class="py-0.5 font-medium">{props.params.collection}</span>}
              >
                <A
                  end
                  href={`/at://${props.params.repo}/${props.params.collection}`}
                  inactiveClass="text-blue-400 grow py-0.5 font-medium hover:text-blue-500 transition-colors duration-150 dark:hover:text-blue-300"
                >
                  {props.params.collection}
                </A>
              </Show>
            </div>
            <CopyButton content={`at://${props.params.repo}/${props.params.collection}`} />
          </div>
        </Show>

        {/* Record Level */}
        <Show when={props.params.rkey}>
          <div class="group flex items-center justify-between gap-2 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <div class="flex basis-full items-center gap-2">
              <Tooltip text="Record">
                <span class="iconify lucide--file-json text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"></span>
              </Tooltip>
              <span class="py-0.5 font-medium">{props.params.rkey}</span>
            </div>
            <CopyButton
              content={`at://${props.params.repo}/${props.params.collection}/${props.params.rkey}`}
            />
          </div>
        </Show>
      </div>
    </nav>
  );
};
