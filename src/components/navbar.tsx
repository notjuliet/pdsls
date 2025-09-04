import { Did, Handle } from "@atcute/lexicons";
import { A, Params, useLocation } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";
import { didDocCache, labelerCache, validateHandle } from "../utils/api";
import { CopyMenu, DropdownMenu, MenuProvider } from "./dropdown";
import Tooltip from "./tooltip";

export const [pds, setPDS] = createSignal<string>();
export const [cid, setCID] = createSignal<string>();
export const [isLabeler, setIsLabeler] = createSignal(false);
export const [validRecord, setValidRecord] = createSignal<boolean | undefined>(undefined);
export const [validSchema, setValidSchema] = createSignal<boolean | undefined>(undefined);

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
  const [validHandle, setValidHandle] = createSignal<boolean | undefined>(undefined);
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
      if (hdl !== handle()) {
        setValidHandle(undefined);
        setHandle(hdl);
        setValidHandle(await validateHandle(hdl as Handle, props.params.repo as Did));
      }
    }
  });

  return (
    <nav class="mt-4 flex w-[22rem] flex-col text-sm wrap-anywhere sm:w-[24rem]">
      <div class="relative flex items-center justify-between gap-1">
        <div class="flex min-h-[1.25rem] basis-full items-center gap-2">
          <Tooltip text="PDS">
            <span class="iconify lucide--hard-drive shrink-0 text-lg"></span>
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
                <span class="iconify lucide--book-user text-lg"></span>
              </Tooltip>
              <div class="flex w-full gap-1">
                {props.params.collection || location.pathname.includes("/labels") ?
                  <A
                    end
                    href={`/at://${props.params.repo}`}
                    inactiveClass={`text-blue-400 hover:underline active:underline ${!showHandle() ? "w-full" : ""}`}
                  >
                    {showHandle() ? handle() : props.params.repo}
                  </A>
                : <span>{showHandle() ? handle() : props.params.repo}</span>}
                <Show when={showHandle()}>
                  <Tooltip
                    text={
                      validHandle() === true ? "Valid handle"
                      : validHandle() === undefined ?
                        "Validating"
                      : "Invalid handle"
                    }
                  >
                    <span
                      classList={{
                        "iconify lucide--circle-check": validHandle() === true,
                        "iconify lucide--circle-x text-red-500 dark:text-red-400":
                          validHandle() === false,
                        "iconify lucide--loader-circle animate-spin": validHandle() === undefined,
                      }}
                    ></span>
                  </Tooltip>
                </Show>
              </div>
            </div>
            <Tooltip text={showHandle() ? "Show DID" : "Show handle"}>
              <button
                class="flex items-center rounded p-0.5 hover:bg-neutral-200 active:bg-neutral-200 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"
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
        <Show when={props.params.repo in labelerCache && !props.params.collection}>
          <div class="mt-1 flex items-center gap-2">
            <span class="iconify lucide--tag text-lg"></span>
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
              <span class="iconify lucide--folder-open text-lg"></span>
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
              <span class="iconify lucide--file-json text-lg"></span>
            </Tooltip>
            <div class="flex gap-1">
              <span>{props.params.rkey}</span>
              <Show when={validRecord()}>
                <Tooltip text="Valid record">
                  <span class="iconify lucide--lock-keyhole"></span>
                </Tooltip>
              </Show>
              <Show when={validRecord() === false}>
                <Tooltip text="Invalid record">
                  <span class="iconify lucide--lock-keyhole-open text-red-500 dark:text-red-400"></span>
                </Tooltip>
              </Show>
              <Show when={validRecord() === undefined}>
                <Tooltip text="Validating">
                  <span class="iconify lucide--loader-circle animate-spin"></span>
                </Tooltip>
              </Show>
              <Show when={validSchema()}>
                <Tooltip text="Valid schema">
                  <span class="iconify lucide--file-check"></span>
                </Tooltip>
              </Show>
              <Show when={validSchema() === false}>
                <Tooltip text="Invalid schema">
                  <span class="iconify lucide--file-x text-red-500 dark:text-red-400"></span>
                </Tooltip>
              </Show>
            </div>
          </div>
        </Show>
      </div>
      <Show when={props.params.rkey && cid()}>
        {(cid) => (
          <div class="mt-1 flex gap-2">
            <Tooltip text="CID">
              <span class="iconify lucide--box text-lg"></span>
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
