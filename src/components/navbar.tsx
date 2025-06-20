import { A, Params } from "@solidjs/router";
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
  "did:plc:b3pn34agqqchkaf75v7h43dk": "i-lucide-lab-fox-face-tail",
  "did:plc:bnqkww7bjxaacajzvu5gswdf": "i-lucide-gem",
  "did:plc:veryepic2bagxnblv63a2hac": "i-arcticons-tetris",
  "did:plc:wbxlr7nn6circzbjz4rootar": "i-lucide-tornado",
  "did:plc:pm6jxakrtzmkorra62cr43kr": "i-lucide-flag",
  "did:plc:355lbopbpckczt672hss2ra4": "i-fluent-emoji-alien",
  "did:plc:44ybard66vv44zksje25o7dz": "i-lucide-mountain-snow",
  "did:plc:q6gjnaw2blty4crticxkmujt": "i-solar-cat-linear",
  "did:plc:oky5czdrnfjpqslsw2a5iclo": "i-tabler-brand-bluesky",
};

const NavBar = (props: { params: Params }) => {
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
    <div class="break-anywhere mt-4 flex w-[21rem] flex-col font-mono text-sm sm:w-[23rem]">
      <div class="relative flex items-center justify-between gap-1">
        <div class="min-h-1.25rem flex basis-full items-center gap-2">
          <Tooltip text="PDS">
            <button
              class="i-lucide-server shrink-0 text-lg"
              onclick={() => addToClipboard(pds()!)}
            />
          </Tooltip>
          <Show when={pds()}>
            <A end href={pds()!} inactiveClass="text-lightblue-500 w-full hover:underline">
              {pds()}
            </A>
          </Show>
        </div>
        <Tooltip text={`Copy ${props.params.repo ? "AT URI" : "PDS"}`}>
          <button
            class="i-lucide-copy shrink-0 text-lg"
            onclick={() =>
              addToClipboard(
                props.params.repo ?
                  `at://${props.params.repo}${props.params.collection ? `/${props.params.collection}` : ""}${props.params.rkey ? `/${props.params.rkey}` : ""}`
                : pds()!,
              )
            }
          />
        </Tooltip>
      </div>
      <div class="flex flex-col flex-wrap">
        <Show when={props.params.repo}>
          <div>
            <div class="relative mt-1 flex items-center justify-between gap-1">
              <div class="flex basis-full items-center gap-2">
                <Tooltip text="Repository">
                  <button
                    class="i-lucide-at-sign text-lg"
                    onclick={() => addToClipboard(props.params.repo)}
                  />
                </Tooltip>
                <A
                  end
                  href={`/at://${props.params.repo}`}
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
                          "i-lucide-circle-check": validHandle() === true,
                          "i-lucide-circle-x text-red-500 dark:text-red-400":
                            validHandle() === false,
                          "i-eos-icons-loading": validHandle() === undefined,
                        }}
                      />
                    }
                  />
                </Show>
              </div>
              <Tooltip text={showHandle() ? "Show DID" : "Show Handle"}>
                <button
                  class={
                    "shrink-0 text-lg " +
                    (swapIcons[props.params.repo] ?? "i-lucide-arrow-left-right")
                  }
                  onclick={() => setShowHandle(!showHandle())}
                />
              </Tooltip>
            </div>
            <Show when={!props.params.collection && !props.params.rkey}>
              <div class="mt-1 flex items-center gap-2">
                <Tooltip text="Blobs">
                  <div class="i-lucide-file-digit text-lg" />
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
              <div class="mt-1 flex items-center gap-2">
                <Tooltip text="Labels">
                  <div class="i-lucide-tag text-lg" />
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
          <div class="mt-1 flex items-center gap-2">
            <Tooltip text="Collection">
              <button
                class="i-lucide-list text-lg"
                onclick={() => addToClipboard(props.params.collection)}
              />
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
          <div class="relative mt-1 flex items-center justify-between">
            <div class="flex basis-full items-center gap-2">
              <Tooltip text="Record">
                <button
                  class="i-lucide-braces text-lg"
                  onclick={() => addToClipboard(props.params.rkey)}
                />
              </Tooltip>
              <span>{props.params.rkey}</span>
              <Show when={validRecord()}>
                <Tooltip text="Valid record" children={<div class="i-lucide-lock-keyhole" />} />
              </Show>
              <Show when={validRecord() === false}>
                <Tooltip
                  text="Invalid record"
                  children={<div class="i-lucide-circle-x text-red-500 dark:text-red-400" />}
                />
              </Show>
              <Show when={validRecord() === undefined}>
                <Tooltip text="Validating" children={<div class="i-eos-icons-loading" />} />
              </Show>
              <Show when={validSchema()}>
                <Tooltip text="Valid schema" children={<div class="i-lucide-file-check" />} />
              </Show>
              <Show when={validSchema() === false}>
                <Tooltip
                  text="Invalid schema"
                  children={<div class="i-lucide-file-x text-red-500 dark:text-red-400" />}
                />
              </Show>
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
          <div class="mt-1 flex items-center gap-1">
            <Tooltip text="CID">
              <button class="i-lucide-box text-lg" onclick={() => addToClipboard(cid())} />
            </Tooltip>
            <button
              dir="rtl"
              classList={{ "bg-transparent": true, truncate: !fullCid() }}
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
