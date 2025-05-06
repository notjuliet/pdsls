import { A, Params } from "@solidjs/router";
import Tooltip from "./tooltip";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { didDocCache, labelerCache, validateHandle } from "../utils/api";
import { setShowHandle, showHandle } from "./settings";

export const [pds, setPDS] = createSignal<string>();
export const [cid, setCID] = createSignal<string>();
export const [isLabeler, setIsLabeler] = createSignal(false);
export const [validRecord, setValidRecord] = createSignal<boolean | undefined>(undefined);

const swapIcons: Record<string, string> = {
  "did:plc:vwzwgnygau7ed7b7wt5ux7y2": "i-hugeicons-nintendo-switch",
  "did:plc:tndeaffsojahb3tzjut27gi5": "i-lucide-bone",
  "did:plc:uu5axsmbm2or2dngy4gwchec": "i-keycap",
  "did:plc:7x6rtuenkuvxq3zsvffp2ide": "i-lucide-rabbit",
  "did:plc:ia76kvnndjutgedggx2ibrem": "i-lucide-rabbit",
  "did:plc:5rowvb4jjbm26fdkx6a5rxls": "i-lucide-rabbit",
  "did:plc:hdhoaan3xa3jiuq4fg4mefid": "i-lucide-lab-shark",
  "did:plc:hvakvedv6byxhufjl23mfmsd": "i-lucide-rat",
  "did:plc:ezhjhbzqt32bqprrn6qjlkri": "i-trogi",
  "did:plc:6v6jqsy7swpzuu53rmzaybjy": "i-lucide-fish",
  "did:plc:hx53snho72xoj7zqt5uice4u": "i-lucide-lab-flower-rose-single",
  "did:plc:wzsilnxf24ehtmmc3gssy5bu": "i-lucide-music-2",
  "did:plc:b3pn34agqqchkaf75v7h43dk": "i-lucide-lab-fox",
};

const NavBar = (props: { params: Params }) => {
  const [openMenu, setOpenMenu] = createSignal(false);
  const [dropdown, setDropdown] = createSignal<HTMLDivElement>();
  const [handle, setHandle] = createSignal(props.params.repo);
  const [validHandle, setValidHandle] = createSignal<boolean | undefined>(undefined);

  const clickEvent = (event: MouseEvent) => {
    if (openMenu() && event.target !== dropdown()) setOpenMenu(false);
  };

  onMount(() => window.addEventListener("click", clickEvent));
  onCleanup(() => window.removeEventListener("click", clickEvent));

  createEffect(async () => {
    if (pds() !== undefined) {
      const hdl =
        didDocCache[props.params.repo]?.alsoKnownAs
          ?.filter((alias) => alias.startsWith("at://"))[0]
          .split("at://")[1] ?? props.params.repo;
      if (hdl !== handle()) {
        setValidHandle(undefined);
        setHandle(hdl);
        setValidHandle(await validateHandle(hdl, props.params.repo));
      }
    }
  });

  return (
    <div class="break-anywhere mt-4 flex w-[21rem] flex-col font-mono text-sm">
      <div class="relative flex items-center justify-between">
        <div class="flex basis-full items-center">
          <Show when={pds() && props.params.pds}>
            <Tooltip text="PDS">
              <div class="i-lucide-server mr-1 shrink-0" />
            </Tooltip>
            <A end href={pds()!} inactiveClass="text-lightblue-500 w-full hover:underline">
              {pds()}
            </A>
          </Show>
        </div>
        <button
          ref={setDropdown}
          class="i-lucide-ellipsis ml-1 shrink-0 text-lg"
          onclick={() => setOpenMenu(!openMenu())}
        />
        <Show when={openMenu()}>
          <div class="text-dark-700 absolute right-0 top-full z-10 w-max rounded-md border border-neutral-500 bg-white p-1 font-sans text-slate-900 dark:bg-neutral-800 dark:text-slate-100">
            <div class="flex flex-col">
              <Show when={props.params.repo}>
                <button
                  class="p-0.75 flex items-center rounded bg-transparent hover:bg-neutral-200 dark:hover:bg-neutral-600"
                  onclick={() => navigator.clipboard.writeText(props.params.repo)}
                >
                  Copy DID
                </button>
                <button
                  class="p-0.75 flex items-center rounded bg-transparent hover:bg-neutral-200 dark:hover:bg-neutral-600"
                  onclick={() =>
                    navigator.clipboard.writeText(
                      `at://${props.params.repo}${props.params.collection ? `/${props.params.collection}` : ""}${props.params.rkey ? `/${props.params.rkey}` : ""}`,
                    )
                  }
                >
                  Copy AT URI
                </button>
              </Show>
              <Show when={cid()}>
                {(cid) => (
                  <button
                    class="p-0.75 flex items-center rounded bg-transparent hover:bg-neutral-200 dark:hover:bg-neutral-600"
                    onclick={() => navigator.clipboard.writeText(cid())}
                  >
                    Copy CID
                  </button>
                )}
              </Show>
              <Show when={pds()}>
                {(pds) => (
                  <button
                    class="p-0.75 flex items-center rounded bg-transparent hover:bg-neutral-200 dark:hover:bg-neutral-600"
                    onclick={() => navigator.clipboard.writeText(pds())}
                  >
                    Copy PDS URL
                  </button>
                )}
              </Show>
            </div>
          </div>
        </Show>
      </div>
      <div class="flex flex-col flex-wrap">
        <Show when={props.params.repo}>
          <div>
            <div class="relative mt-1 flex items-center justify-between">
              <div class="flex basis-full items-center">
                <Tooltip text="Repository">
                  <div class="i-atproto-logo mr-1" />
                </Tooltip>
                <A
                  end
                  href={`/at://${props.params.repo}`}
                  class="mr-1"
                  inactiveClass="text-lightblue-500 hover:underline"
                >
                  {showHandle() ? handle() : props.params.repo}
                </A>
                <Show when={showHandle()}>
                  <Tooltip
                    text={
                      validHandle() === true ? "Valid handle"
                      : validHandle() === undefined ?
                        "Validating"
                      : "Invalid handle"
                    }
                    children={
                      <div
                        classList={{
                          "i-lucide-check-circle": validHandle() === true,
                          "i-lucide-dismiss-circle text-red-500 dark:text-red-400":
                            validHandle() === false,
                          "i-line-md-loading-twotone-loop": validHandle() === undefined,
                        }}
                      />
                    }
                  />
                </Show>
              </div>
              <Tooltip text={showHandle() ? "Show DID" : "Show Handle"}>
                <button
                  class={
                    "ml-1 shrink-0 text-lg " +
                    (swapIcons[props.params.repo] ?? "i-lucide-arrow-right-left")
                  }
                  onclick={() => setShowHandle(!showHandle())}
                />
              </Tooltip>
            </div>
            <Show when={!props.params.collection && !props.params.rkey}>
              <div class="mt-1 flex items-center">
                <Tooltip text="Blobs">
                  <div class="i-lucide-binary mr-1" />
                </Tooltip>
                <A
                  end
                  href={`/at://${props.params.repo}/blobs`}
                  inactiveClass="text-lightblue-500 w-full hover:underline"
                >
                  blobs
                </A>
              </div>
            </Show>
            <Show
              when={
                props.params.repo in labelerCache && !props.params.collection && !props.params.rkey
              }
            >
              <div class="mt-1 flex items-center">
                <Tooltip text="Labels">
                  <div class="i-lucide-tag mr-1" />
                </Tooltip>
                <A
                  end
                  href={`/at://${props.params.repo}/labels`}
                  inactiveClass="text-lightblue-500 w-full hover:underline"
                >
                  labels
                </A>
              </div>
            </Show>
          </div>
        </Show>
        <Show when={props.params.collection}>
          <div class="mt-1 flex items-center">
            <Tooltip text="Collection">
              <div class="i-lucide-list mr-1" />
            </Tooltip>
            <A
              end
              href={`/at://${props.params.repo}/${props.params.collection}`}
              inactiveClass="text-lightblue-500 w-full hover:underline"
            >
              {props.params.collection}
            </A>
          </div>
        </Show>
        <Show when={props.params.rkey}>
          <div class="mt-1 flex items-center">
            <Tooltip text="Record">
              <div class="i-lucide-braces mr-1" />
            </Tooltip>
            <span class="mr-1 cursor-pointer">{props.params.rkey}</span>
            <Show when={validRecord()}>
              <Tooltip text="Valid record" children={<div class="i-lucide-check-circle" />} />
            </Show>
            <Show when={validRecord() === false}>
              <Tooltip
                text="Invalid record"
                children={<div class="i-lucide-dismiss-circle text-red-500 dark:text-red-400" />}
              />
            </Show>
            <Show when={validRecord() === undefined}>
              <Tooltip
                text="Validating"
                children={<div class="i-line-md-loading-twotone-loop" />}
              />
            </Show>
          </div>
        </Show>
      </div>
      <Show when={props.params.rkey && cid()}>
        {(cid) => (
          <div class="mt-1 flex items-center">
            <Tooltip text="CID">
              <div class="i-lucide-box mr-1" />
            </Tooltip>
            <span dir="rtl" class="truncate">
              {cid()}
            </span>
          </div>
        )}
      </Show>
    </div>
  );
};

export { NavBar };
