import { A, Params, useLocation } from "@solidjs/router";
import Tooltip from "./tooltip";
import { createEffect, createSignal, Show } from "solid-js";
import { didDocCache, labelerCache, validateHandle } from "../utils/api";
import { setShowHandle, showHandle } from "./settings";
import { Did, Handle } from "@atcute/lexicons";
import { addToClipboard } from "../utils/copy";

export const [pds, setPDS] = createSignal<string>();
export const [cid, setCID] = createSignal<string>();
export const [isLabeler, setIsLabeler] = createSignal(false);
export const [validRecord, setValidRecord] = createSignal<boolean | undefined>(undefined);
export const [validSchema, setValidSchema] = createSignal<boolean | undefined>(undefined);

const swapIcons: Record<string, string> = {
  "did:plc:vwzwgnygau7ed7b7wt5ux7y2": "i-lucide-microchip",
  "did:plc:oisofpd7lj26yvgiivf3lxsi": "i-lucide-bone",
  "did:plc:uu5axsmbm2or2dngy4gwchec": "i-lucide-train-track",
  "did:plc:7x6rtuenkuvxq3zsvffp2ide": "i-lucide-rabbit",
  "did:plc:ia76kvnndjutgedggx2ibrem": "i-lucide-rabbit",
  "did:plc:5rowvb4jjbm26fdkx6a5rxls": "i-lucide-rabbit",
  "did:plc:hdhoaan3xa3jiuq4fg4mefid": "i-lucide-lab-shark",
  "did:plc:hvakvedv6byxhufjl23mfmsd": "i-lucide-rat",
  "did:plc:ezhjhbzqt32bqprrn6qjlkri": "i-lucide-film",
  "did:plc:6v6jqsy7swpzuu53rmzaybjy": "i-lucide-fish",
  "did:plc:hx53snho72xoj7zqt5uice4u": "i-lucide-lab-flower-rose-single",
  "did:plc:wzsilnxf24ehtmmc3gssy5bu": "i-lucide-music-2",
  "did:plc:bnqkww7bjxaacajzvu5gswdf": "i-lucide-gem",
  "did:plc:pm6jxakrtzmkorra62cr43kr": "i-lucide-flag",
  "did:plc:355lbopbpckczt672hss2ra4": "i-lucide-lab-basketball",
  "did:plc:44ybard66vv44zksje25o7dz": "i-lucide-mountain-snow",
  "did:plc:q6gjnaw2blty4crticxkmujt": "i-lucide-cat",
  "did:plc:oky5czdrnfjpqslsw2a5iclo": "i-tabler-brand-bluesky",
};

const NavBar = (props: { params: Params }) => {
  const location = useLocation();
  const [handle, setHandle] = createSignal(props.params.repo);
  const [validHandle, setValidHandle] = createSignal<boolean | undefined>(undefined);
  const [fullCid, setFullCid] = createSignal(false);

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
    <div class="break-anywhere mt-4 flex w-[21rem] flex-col font-mono text-sm sm:w-[24rem]">
      <div class="relative flex items-center justify-between gap-1">
        <div class="min-h-1.25rem flex basis-full items-center gap-2">
          <Tooltip text="PDS">
            <button onclick={() => addToClipboard(pds()!)}>
              <div class="i-lucide-server shrink-0 text-lg" />
            </button>
          </Tooltip>
          <Show when={pds()}>
            <Show when={props.params.repo}>
              <A end href={pds()!} inactiveClass="text-blue-400 w-full hover:underline">
                {pds()}
              </A>
            </Show>
            <Show when={!props.params.repo}>
              <span>{pds()}</span>
            </Show>
          </Show>
        </div>
        <Tooltip
          text={`Copy ${
            props.params.collection ? "AT URI"
            : props.params.repo ? "DID"
            : "PDS"
          }`}
        >
          <button
            onclick={() =>
              addToClipboard(
                props.params.collection ?
                  `at://${props.params.repo}/${props.params.collection}${props.params.rkey ? `/${props.params.rkey}` : ""}`
                : props.params.repo ? props.params.repo
                : pds()!,
              )
            }
          >
            <div class="i-lucide-copy shrink-0 text-lg" />
          </button>
        </Tooltip>
      </div>
      <div class="flex flex-col flex-wrap">
        <Show when={props.params.repo}>
          <div>
            <div class="relative mt-1 flex items-center justify-between gap-1">
              <div class="flex basis-full items-center gap-2">
                <Tooltip text="Repository">
                  <button onclick={() => addToClipboard(props.params.repo)}>
                    <div class="i-lucide-at-sign text-lg" />
                  </button>
                </Tooltip>
                <div class="flex gap-1">
                  {props.params.collection || location.pathname.includes("/labels") ?
                    <A
                      end
                      href={`/at://${props.params.repo}`}
                      inactiveClass="text-blue-400 hover:underline"
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
                      <div
                        classList={{
                          "i-lucide-circle-check": validHandle() === true,
                          "i-lucide-circle-x text-red-500 dark:text-red-400":
                            validHandle() === false,
                          "i-lucide-loader-circle animate-spin": validHandle() === undefined,
                        }}
                      />
                    </Tooltip>
                  </Show>
                </div>
              </div>
              <Tooltip text={showHandle() ? "Show DID" : "Show Handle"}>
                <button onclick={() => setShowHandle(!showHandle())}>
                  <div
                    class={
                      "shrink-0 text-lg " +
                      (swapIcons[props.params.repo] ?? "i-lucide-arrow-left-right")
                    }
                  />
                </button>
              </Tooltip>
            </div>
            <Show when={props.params.repo in labelerCache && !props.params.collection}>
              <div class="mt-1 flex items-center gap-2">
                <div class="i-lucide-tag text-lg" />
                <A
                  end
                  href={`/at://${props.params.repo}/labels`}
                  inactiveClass="text-blue-400 grow hover:underline"
                >
                  labels
                </A>
              </div>
            </Show>
          </div>
        </Show>
        <Show when={props.params.collection}>
          <div class="mt-1 flex items-center gap-2">
            <Tooltip text="Collection">
              <button onclick={() => addToClipboard(props.params.collection)}>
                <div class="i-lucide-list text-lg" />
              </button>
            </Tooltip>
            <Show when={props.params.rkey}>
              <A
                end
                href={`/at://${props.params.repo}/${props.params.collection}`}
                inactiveClass="text-blue-400 w-full hover:underline"
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
          <div class="mt-1 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Tooltip text="Record">
                <button onclick={() => addToClipboard(props.params.rkey)}>
                  <div class="i-lucide-braces text-lg" />
                </button>
              </Tooltip>
              <div class="flex gap-1">
                <span>{props.params.rkey}</span>
                <Show when={validRecord()}>
                  <Tooltip text="Valid record">
                    <div class="i-lucide-lock-keyhole" />
                  </Tooltip>
                </Show>
                <Show when={validRecord() === false}>
                  <Tooltip text="Invalid record">
                    <div class="i-lucide-lock-keyhole-open text-red-500 dark:text-red-400" />
                  </Tooltip>
                </Show>
                <Show when={validRecord() === undefined}>
                  <Tooltip text="Validating">
                    <div class="i-lucide-loader-circle animate-spin" />
                  </Tooltip>
                </Show>
                <Show when={validSchema()}>
                  <Tooltip text="Valid schema">
                    <div class="i-lucide-file-check" />
                  </Tooltip>
                </Show>
                <Show when={validSchema() === false}>
                  <Tooltip text="Invalid schema">
                    <div class="i-lucide-file-x text-red-500 dark:text-red-400" />
                  </Tooltip>
                </Show>
              </div>
            </div>
            <Tooltip text="Record on PDS">
              <a
                href={`https://${pds()}/xrpc/com.atproto.repo.getRecord?repo=${props.params.repo}&collection=${props.params.collection}&rkey=${props.params.rkey}`}
                target="_blank"
              >
                <div class="i-lucide-external-link text-lg" />
              </a>
            </Tooltip>
          </div>
        </Show>
      </div>
      <Show when={props.params.rkey && cid()}>
        {(cid) => (
          <div class="mt-1 flex gap-2">
            <Tooltip text="CID">
              <button onclick={() => addToClipboard(cid())}>
                <div class="i-lucide-box text-lg" />
              </button>
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
    </div>
  );
};

export { NavBar };
