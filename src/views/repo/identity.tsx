import { DidDocument } from "@atcute/identity";
import { Did, Handle } from "@atcute/lexicons";
import { createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { canHover } from "../../layout.jsx";
import { type HandleResolveResult, resolveHandleDetailed, validateHandle } from "../../lib/api.js";
import { detectDidKeyType, detectKeyType } from "../../lib/key.js";
import { addToClipboard } from "../../utils/copy.js";

const HandleResult = (props: {
  method: string;
  result: HandleResolveResult;
  expectedDid: string;
}) => {
  const ok = () => props.result.success && props.result.did === props.expectedDid;
  const mismatch = () => props.result.success && props.result.did !== props.expectedDid;

  return (
    <div class="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 text-sm">
      <div class="flex items-center gap-1.5 font-medium whitespace-nowrap">
        <span
          classList={{
            "iconify lucide--check text-green-600 dark:text-green-400": ok(),
            "iconify lucide--x text-red-500 dark:text-red-400": !ok(),
          }}
        ></span>
        <span>{props.method}</span>
      </div>
      <Show
        when={props.result.success}
        fallback={
          <div class="min-w-0 wrap-anywhere text-red-500 dark:text-red-400">
            {props.result.error}
          </div>
        }
      >
        <div class="min-w-0 truncate text-neutral-500 dark:text-neutral-400">
          {props.result.did}
        </div>
      </Show>
      <Show when={mismatch()}>
        <span></span>
        <div class="min-w-0 wrap-anywhere text-red-500 dark:text-red-400">
          Expected: {props.expectedDid}
        </div>
      </Show>
    </div>
  );
};

const AliasEntry = (props: { alias: string; did: string; valid: boolean | undefined }) => {
  const [expanded, setExpanded] = createSignal(false);
  const [result, setResult] = createSignal<{
    dns: HandleResolveResult;
    http: HandleResolveResult;
  } | null>(null);

  return (
    <Show
      when={props.alias.startsWith("at://")}
      fallback={<div class="text-sm text-neutral-700 dark:text-neutral-300">{props.alias}</div>}
    >
      <div class="flex flex-col gap-1">
        <button
          class="-ml-1 flex w-fit max-w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm text-neutral-700 hover:bg-neutral-200 active:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-700"
          aria-expanded={expanded()}
          onClick={async () => {
            if (expanded()) {
              setExpanded(false);
            } else {
              setResult(null);
              setExpanded(true);
              const handle = props.alias.replace("at://", "") as Handle;
              const r = await resolveHandleDetailed(handle);
              if (expanded()) setResult(r);
            }
          }}
        >
          <span class="truncate">{props.alias}</span>
          <span
            classList={{
              "iconify text-base shrink-0 lucide--check text-green-600 dark:text-green-400":
                props.valid === true,
              "iconify lucide--x text-red-500 dark:text-red-400": props.valid === false,
              "iconify lucide--loader-circle animate-spin": props.valid === undefined,
            }}
          ></span>
        </button>

        <Show when={expanded()}>
          <div class="mb-2 ml-2.5 border-l border-neutral-200 pl-2.5 dark:border-neutral-700">
            <div class="mb-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Resolution
            </div>
            <Show
              when={result()}
              fallback={
                <div class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                  <span class="iconify lucide--loader-circle animate-spin"></span>
                  <span>Resolving handle...</span>
                </div>
              }
            >
              {(r) => (
                <div class="flex flex-col gap-1.5">
                  <HandleResult method="DNS TXT" result={r().dns} expectedDid={props.did} />
                  <HandleResult method="/.well-known" result={r().http} expectedDid={props.did} />
                </div>
              )}
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
};

const handleValidationCache = new Map<string, Record<string, boolean>>();

export const IdentityView = (props: { didDoc: DidDocument; rotationKeys: string[] }) => {
  const did = props.didDoc.id;
  const cached = handleValidationCache.get(did);
  const [validHandles, setValidHandles] = createStore<Record<string, boolean>>(cached ?? {});

  if (!cached) {
    (async () => {
      for (const alias of props.didDoc.alsoKnownAs ?? []) {
        if (alias.startsWith("at://")) {
          const valid = await validateHandle(alias.replace("at://", "") as Handle, did as Did);
          setValidHandles(alias, valid);
        }
      }
      handleValidationCache.set(did, { ...validHandles });
    })();
  }

  return (
    <div class="flex flex-col gap-3 wrap-anywhere">
      {/* DID */}
      <div>
        <div class="font-semibold">DID</div>
        <button
          class="group flex w-full items-center gap-1 text-left text-sm text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-200"
          onClick={() => addToClipboard(did)}
        >
          <span class="truncate">{did}</span>
          <span
            classList={{
              "iconify lucide--copy shrink-0": true,
              "opacity-0 group-hover:opacity-100": canHover,
            }}
          ></span>
        </button>
      </div>

      {/* Aliases */}
      <Show when={props.didDoc.alsoKnownAs}>
        <div>
          <p class="font-semibold">Aliases</p>
          <For each={props.didDoc.alsoKnownAs}>
            {(alias) => <AliasEntry alias={alias} did={did} valid={validHandles[alias]} />}
          </For>
        </div>
      </Show>

      {/* Services */}
      <Show when={props.didDoc.service}>
        <div>
          <p class="font-semibold">Services</p>
          <div class="flex flex-col gap-1">
            <For each={props.didDoc.service}>
              {(service) => (
                <div class="grid grid-cols-[auto_1fr] items-center gap-x-1 text-sm text-neutral-700 dark:text-neutral-300">
                  <span class="iconify lucide--hash"></span>
                  <div class="flex items-center gap-2">
                    <span>{service.id.split("#")[1]}</span>
                    <div class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                      <span
                        class="iconify text-xs"
                        classList={{
                          "lucide--hard-drive": service.type === "AtprotoPersonalDataServer",
                          "lucide--tag": service.type === "AtprotoLabeler",
                          "lucide--rss": service.type === "BskyFeedGenerator",
                          "lucide--wrench": ![
                            "AtprotoPersonalDataServer",
                            "AtprotoLabeler",
                            "BskyFeedGenerator",
                          ].includes(service.type.toString()),
                        }}
                      ></span>
                      <span>{service.type}</span>
                    </div>
                  </div>
                  <span></span>
                  <a
                    class="w-fit underline hover:text-blue-500 dark:hover:text-blue-400"
                    href={service.serviceEndpoint.toString()}
                    target="_blank"
                    rel="noopener"
                  >
                    {service.serviceEndpoint.toString()}
                  </a>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Verification Methods */}
      <Show when={props.didDoc.verificationMethod}>
        <div>
          <p class="font-semibold">Verification Methods</p>
          <div class="flex flex-col gap-1">
            <For each={props.didDoc.verificationMethod}>
              {(verif) => (
                <Show when={verif.publicKeyMultibase}>
                  {(key) => (
                    <div class="grid grid-cols-[auto_1fr] items-center gap-x-1 text-sm text-neutral-700 dark:text-neutral-300">
                      <span class="iconify lucide--hash"></span>
                      <div class="flex items-center gap-2">
                        <span>{verif.id.split("#")[1]}</span>
                        <div class="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                          <span class="iconify lucide--key-round text-xs"></span>
                          <span>{detectKeyType(key())}</span>
                        </div>
                      </div>
                      <span></span>
                      <div class="font-mono break-all">{key()}</div>
                    </div>
                  )}
                </Show>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Rotation Keys */}
      <Show when={props.rotationKeys.length > 0}>
        <div>
          <p class="font-semibold">Rotation Keys</p>
          <div class="flex flex-col gap-1">
            <For each={props.rotationKeys}>
              {(key) => (
                <div class="grid grid-cols-[auto_1fr] items-center gap-x-1 text-sm text-neutral-700 dark:text-neutral-300">
                  <span class="iconify lucide--key-round"></span>
                  <span>{detectDidKeyType(key)}</span>
                  <span></span>
                  <div class="font-mono break-all">{key.replace("did:key:", "")}</div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
};
