import * as TID from "@atcute/tid";
import { A, Params } from "@solidjs/router";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { isTouchDevice } from "../layout";
import { didDocCache } from "../utils/api";
import { addToClipboard } from "../utils/copy";
import { localDateFromTimestamp } from "../utils/date";
import Tooltip from "./tooltip";

export const [pds, setPDS] = createSignal<string>();

const CopyButton = (props: { content: string; label: string }) => {
  return (
    <Show when={!isTouchDevice}>
      <Tooltip text={props.label}>
        <button
          type="button"
          onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addToClipboard(props.content);
          }}
          class={`-mr-2 hidden items-center rounded px-2 py-1 text-neutral-500 transition-all duration-200 group-hover:flex hover:bg-neutral-200/70 hover:text-neutral-600 active:bg-neutral-300/70 sm:py-1.5 dark:text-neutral-400 dark:hover:bg-neutral-700/70 dark:hover:text-neutral-300 dark:active:bg-neutral-600/70`}
          aria-label="Copy to clipboard"
        >
          <span class="iconify lucide--copy"></span>
        </button>
      </Tooltip>
    </Show>
  );
};

export const NavBar = (props: { params: Params }) => {
  const [handle, setHandle] = createSignal(props.params.repo);
  const [repoHovered, setRepoHovered] = createSignal(false);
  const [hasHoveredRepo, setHasHoveredRepo] = createSignal(false);
  const [faviconLoaded, setFaviconLoaded] = createSignal(false);
  const isCustomDomain = () => handle() && !handle()!.endsWith(".bsky.social");

  createEffect(() => {
    if (pds() !== undefined && props.params.repo) {
      const hdl =
        didDocCache[props.params.repo]?.alsoKnownAs
          ?.filter((alias) => alias.startsWith("at://"))[0]
          ?.split("at://")[1] ?? props.params.repo;
      if (hdl !== handle()) setHandle(hdl);
    }
  });

  createEffect(() => {
    handle();
    setHasHoveredRepo(false);
    setFaviconLoaded(false);
  });

  const rkeyTimestamp = createMemo(() => {
    if (!props.params.rkey || !TID.validate(props.params.rkey)) return undefined;
    const timestamp = TID.parse(props.params.rkey).timestamp / 1000;
    return timestamp <= Date.now() ? timestamp : undefined;
  });

  return (
    <nav class="flex w-full flex-col text-sm wrap-anywhere sm:text-base">
      {/* PDS Level */}
      <div class="group relative flex items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
        <div class="flex min-h-6 basis-full items-center gap-2 sm:min-h-7">
          <Tooltip text="PDS">
            <span
              classList={{
                "iconify shrink-0 transition-colors duration-200": true,
                "lucide--alert-triangle text-red-500 dark:text-red-400":
                  pds() === "Missing PDS" && props.params.repo?.startsWith("did:"),
                "lucide--hard-drive text-neutral-500 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200":
                  pds() !== "Missing PDS" || !props.params.repo?.startsWith("did:"),
              }}
            ></span>
          </Tooltip>
          <Show when={pds() && (pds() !== "Missing PDS" || props.params.repo?.startsWith("did:"))}>
            <Show
              when={pds() === "Missing PDS"}
              fallback={
                <Show
                  when={props.params.repo}
                  fallback={<span class="py-0.5 font-medium">{pds()}</span>}
                >
                  <A
                    end
                    href={pds()!}
                    inactiveClass="text-blue-500 py-0.5 w-full font-medium hover:text-blue-600 transition-colors duration-150 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {pds()}
                  </A>
                </Show>
              }
            >
              <span class="py-0.5 font-medium text-red-500 dark:text-red-400">{pds()}</span>
            </Show>
          </Show>
        </div>
        <Show when={pds() && pds() !== "Missing PDS"}>
          <CopyButton content={pds()!} label="Copy PDS" />
        </Show>
      </div>

      <div class="flex flex-col">
        <Show when={props.params.repo}>
          {/* Repository Level */}
          <div
            class="group relative flex items-center justify-between gap-1 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40"
            onMouseEnter={() => {
              setRepoHovered(true);
              setHasHoveredRepo(true);
            }}
            onMouseLeave={() => setRepoHovered(false)}
          >
            <div class="flex min-w-0 basis-full items-center gap-2">
              <Tooltip text="Repository">
                <div class="relative flex h-5 w-4 shrink-0 items-center justify-center">
                  <span
                    class="iconify lucide--book-user absolute text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"
                    classList={{
                      hidden:
                        (repoHovered() && isCustomDomain() && faviconLoaded()) ||
                        (repoHovered() && handle() === "jcsalterego.bsky.social"),
                    }}
                  ></span>
                  <Show when={repoHovered() && handle() === "jcsalterego.bsky.social"}>
                    <div class="flex size-4 items-center justify-center rounded-full bg-blue-500">
                      <span class="iconify lucide--check size-2.5 text-white"></span>
                    </div>
                  </Show>
                  <Show when={hasHoveredRepo() && isCustomDomain()}>
                    <img
                      src={`https://${handle()}/favicon.ico`}
                      class="size-4"
                      classList={{ hidden: !repoHovered() || !faviconLoaded() }}
                      onLoad={() => setFaviconLoaded(true)}
                      onError={() => setFaviconLoaded(false)}
                    />
                  </Show>
                </div>
              </Tooltip>
              <Show
                when={props.params.collection}
                fallback={
                  <span class="flex min-w-0 gap-1 py-0.5 font-medium">
                    <Show
                      when={handle() !== props.params.repo}
                      fallback={<span class="truncate">{props.params.repo}</span>}
                    >
                      <span class="max-w-full shrink-0 truncate">{handle()}</span>
                      <span class="truncate text-neutral-500 dark:text-neutral-400">
                        ({props.params.repo})
                      </span>
                    </Show>
                  </span>
                }
              >
                <A
                  end
                  href={`/at://${props.params.repo}`}
                  inactiveClass="flex grow min-w-0 gap-1 py-0.5 font-medium text-blue-500 hover:text-blue-600 transition-colors duration-150 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Show
                    when={handle() !== props.params.repo}
                    fallback={<span class="truncate">{props.params.repo}</span>}
                  >
                    <span class="max-w-full shrink-0 truncate">{handle()}</span>
                    <span class="truncate">({props.params.repo})</span>
                  </Show>
                </A>
              </Show>
            </div>
            <CopyButton content={props.params.repo!} label="Copy DID" />
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
                  inactiveClass="text-blue-500 dark:text-blue-400 grow py-0.5 font-medium hover:text-blue-600 transition-colors duration-150 dark:hover:text-blue-300"
                >
                  {props.params.collection}
                </A>
              </Show>
            </div>
            <CopyButton
              content={`at://${props.params.repo}/${props.params.collection}`}
              label="Copy AT URI"
            />
          </div>
        </Show>

        {/* Record Level */}
        <Show when={props.params.rkey}>
          <div class="group flex items-center justify-between gap-2 rounded-md border-[0.5px] border-transparent bg-transparent px-2 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40">
            <div class="flex basis-full items-center gap-2">
              <Tooltip text="Record">
                <span class="iconify lucide--file-json text-neutral-500 transition-colors duration-200 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200"></span>
              </Tooltip>
              <div class="flex min-w-0 gap-1 py-0.5 font-medium">
                <span>{props.params.rkey}</span>
                <Show when={rkeyTimestamp()}>
                  <span class="truncate text-neutral-500 dark:text-neutral-400">
                    ({localDateFromTimestamp(rkeyTimestamp()!)})
                  </span>
                </Show>
              </div>
            </div>
            <CopyButton
              content={`at://${props.params.repo}/${props.params.collection}/${props.params.rkey}`}
              label="Copy AT URI"
            />
          </div>
        </Show>
      </div>
    </nav>
  );
};
