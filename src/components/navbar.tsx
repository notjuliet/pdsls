import { A, Params, useLocation } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";
import { didDocCache, labelerCache } from "../utils/api";
import { CopyMenu, DropdownMenu, MenuProvider } from "./dropdown";
import Tooltip from "./tooltip";

export const [pds, setPDS] = createSignal<string>();
export const [cid, setCID] = createSignal<string>();
export const [isLabeler, setIsLabeler] = createSignal(false);

const swapIcons: Record<string, string> = {
  "did:plc:vwzwgnygau7ed7b7wt5ux7y2": "lucide--microchip",
  "did:plc:oisofpd7lj26yvgiivf3lxsi": "lucide--bone",
  "did:plc:uu5axsmbm2or2dngy4gwchec": "lucide--train-track",
  "did:plc:7x6rtuenkuvxq3zsvffp2ide": "lucide--rabbit",
  "did:plc:ia76kvnndjutgedggx2ibrem": "lucide--rabbit",
  "did:plc:hvakvedv6byxhufjl23mfmsd": "lucide--rat",
  "did:plc:ezhjhbzqt32bqprrn6qjlkri": "lucide--film",
  "did:plc:6v6jqsy7swpzuu53rmzaybjy": "lucide--fish",
  "did:plc:hx53snho72xoj7zqt5uice4u": "lucide--rose",
  "did:plc:wzsilnxf24ehtmmc3gssy5bu": "lucide--music-2",
  "did:plc:bnqkww7bjxaacajzvu5gswdf": "lucide--gem",
  "did:plc:hdhoaan3xa3jiuq4fg4mefid": "lucide--sparkles",
};

const NavBar = (props: { params: Params }) => {
  const location = useLocation();
  const [handle, setHandle] = createSignal(props.params.repo);
  const [fullCid, setFullCid] = createSignal(false);
  const [showHandle, setShowHandle] = createSignal(localStorage.showHandle === "true");

  createEffect(() => {
    if (cid() !== undefined) setFullCid(false);
  });

  createEffect(async () => {
    if (pds() !== undefined && props.params.repo) {
      const hdl =
        didDocCache[props.params.repo]?.alsoKnownAs
          ?.filter((alias) => alias.startsWith("at://"))[0]
          .split("at://")[1] ?? props.params.repo;
      if (hdl !== handle()) setHandle(hdl);
    }
  });

  return (
    <nav class="flex w-full flex-col px-2 text-sm wrap-anywhere">
      <div class="relative flex items-center justify-between gap-1">
        <div class="flex min-h-[1.25rem] basis-full items-center gap-2">
          <Tooltip text="PDS">
            <span class="iconify lucide--hard-drive shrink-0 text-base"></span>
          </Tooltip>
          <Show when={pds()}>
            <Show when={props.params.repo}>
              <A
                end
                href={pds()!}
                inactiveClass="text-blue-400 w-full hover:underline active:underline"
              >
                {pds()}
              </A>
            </Show>
            <Show when={!props.params.repo}>
              <span>{pds()}</span>
            </Show>
          </Show>
        </div>
        <MenuProvider>
          <DropdownMenu
            icon="lucide--copy text-base"
            buttonClass="rounded p-0.5"
            menuClass="top-6 p-2 text-xs"
          >
            <Show when={pds()}>
              <CopyMenu copyContent={pds()!} label="Copy PDS" />
            </Show>
            <Show when={props.params.repo}>
              <CopyMenu copyContent={props.params.repo} label="Copy DID" />
              <CopyMenu
                copyContent={`at://${props.params.repo}${props.params.collection ? `/${props.params.collection}` : ""}${props.params.rkey ? `/${props.params.rkey}` : ""}`}
                label="Copy AT URI"
              />
            </Show>
            <Show when={props.params.rkey && cid()}>
              <CopyMenu copyContent={cid()!} label="Copy CID" />
            </Show>
          </DropdownMenu>
        </MenuProvider>
      </div>
      <div class="flex flex-col flex-wrap">
        <Show when={props.params.repo}>
          <div class="relative mt-1 flex items-center justify-between gap-1">
            <div class="flex basis-full items-center gap-2">
              <Tooltip text="Repository">
                <span class="iconify lucide--book-user text-base"></span>
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
                class="flex items-center rounded p-0.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                onclick={() => {
                  localStorage.showHandle = !showHandle();
                  setShowHandle(!showHandle());
                }}
              >
                <span
                  class={
                    `iconify shrink-0 text-base transition-transform duration-400 ${showHandle() ? "rotate-y-180" : ""} ` +
                    (swapIcons[props.params.repo] ?? "lucide--arrow-left-right")
                  }
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
          <div class="mt-1 flex items-center gap-2">
            <span class="iconify lucide--tag text-base"></span>
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
          <div class="mt-1 flex items-center gap-2">
            <Tooltip text="Collection">
              <span class="iconify lucide--folder-open text-base"></span>
            </Tooltip>
            <Show when={props.params.rkey}>
              <A
                end
                href={`/at://${props.params.repo}/${props.params.collection}`}
                inactiveClass="text-blue-400 w-full hover:underline active:underline"
              >
                {props.params.collection}
              </A>
            </Show>
            <Show when={!props.params.rkey}>
              <span>{props.params.collection}</span>
            </Show>
          </div>
        </Show>
        <Show when={props.params.rkey}>
          <div class="mt-1 flex items-center gap-2">
            <Tooltip text="Record">
              <span class="iconify lucide--file-json text-base"></span>
            </Tooltip>
            <span>{props.params.rkey}</span>
          </div>
        </Show>
      </div>
      <Show when={props.params.rkey && cid()}>
        {(cid) => (
          <div class="mt-1 flex gap-2">
            <Tooltip text="CID">
              <span class="iconify lucide--box text-base"></span>
            </Tooltip>
            <button
              dir="rtl"
              classList={{ "bg-transparent text-left": true, truncate: !fullCid() }}
              onclick={() => setFullCid(!fullCid())}
            >
              {cid()}
            </button>
          </div>
        )}
      </Show>
    </nav>
  );
};

export { NavBar };
