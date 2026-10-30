import { DidDocument } from "@atcute/identity";
import { Did, Handle } from "@atcute/lexicons";
import { createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";

import { ExternalLink } from "../../components/ui/external-link.jsx";
import {
  CopyValue,
  HEADING_CLASS,
  LABEL_COLUMN_CLASS,
  VALUE_CLASS,
} from "../../components/ui/info.jsx";
import { Spinner } from "../../components/ui/states.jsx";
import { type HandleResolveResult, resolveHandleDetailed, validateHandle } from "../../lib/api.js";
import { detectDidKeyType, detectKeyType } from "../../lib/key.js";
import { hasStandardServiceId, serviceLabel } from "../../lib/services.js";
import { plcDirectory } from "../settings.jsx";

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
          class="-ml-1 flex w-fit max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-200/80 dark:text-neutral-300 dark:hover:bg-neutral-700/50"
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
          <div class="mb-2 ml-2.5 border-l-[1.5px] border-neutral-300 pl-2.5 dark:border-neutral-600">
            <div class="mb-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Resolution
            </div>
            <Show
              when={result()}
              fallback={
                <div class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                  <Spinner />
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

/** Whether a service is under the usual id for its type, so the type alone says what it is. */
const hasStandardId = (service: { id: string; type: unknown }) =>
  hasStandardServiceId(String(service.type), fragment(service.id));

/** The part of a DID document id after `#`. */
const fragment = (id: string) => id.split("#")[1];

/** A DID document entry's fragment id, like `#atproto_pds`. */
const EntryHeader = (props: { id: string }) => (
  <span class={`font-mono ${VALUE_CLASS}`}>#{fragment(props.id)}</span>
);

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

  const didDocumentUrl = () =>
    did.startsWith("did:plc")
      ? `${plcDirectory()}/${did}`
      : `https://${did.split("did:web:")[1]}/.well-known/did.json`;

  return (
    <div class="flex flex-col gap-4 wrap-anywhere">
      <section>
        <h3 class={HEADING_CLASS}>DID</h3>
        <CopyValue value={did} />
      </section>

      <Show when={props.didDoc.alsoKnownAs?.length}>
        <section>
          <h3 class={HEADING_CLASS}>Aliases</h3>
          <For each={props.didDoc.alsoKnownAs}>
            {(alias) => <AliasEntry alias={alias} did={did} valid={validHandles[alias]} />}
          </For>
        </section>
      </Show>

      <Show when={props.didDoc.service?.length}>
        <section>
          <h3 class={HEADING_CLASS}>Services</h3>
          <div class="flex flex-col gap-1">
            <For each={props.didDoc.service}>
              {(service) => (
                <div class="flex flex-col gap-0.5 text-sm">
                  <Show when={!hasStandardId(service)}>
                    <EntryHeader id={service.id} />
                  </Show>
                  <div class="flex items-center gap-1">
                    {/* Not muted like a key's type: it names the entry, like a key's `#atproto` id. */}
                    <span
                      class={`${LABEL_COLUMN_CLASS} ${VALUE_CLASS}`}
                      title={service.type.toString()}
                    >
                      {serviceLabel(service.type.toString())}
                    </span>
                    <span class="min-w-0">
                      <ExternalLink href={service.serviceEndpoint.toString()}>
                        {service.serviceEndpoint.toString().replace(/^https:\/\//, "")}
                      </ExternalLink>
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>

      <Show when={props.didDoc.verificationMethod?.length}>
        <section>
          <h3 class={HEADING_CLASS}>Verification methods</h3>
          <div class="flex flex-col gap-2">
            <For each={props.didDoc.verificationMethod}>
              {(verif) => (
                <Show when={verif.publicKeyMultibase}>
                  {(key) => (
                    <div class="flex flex-col gap-0.5 text-sm">
                      <EntryHeader id={verif.id} />
                      <CopyValue value={key()} label={detectKeyType(key())} mono quiet />
                    </div>
                  )}
                </Show>
              )}
            </For>
          </div>
        </section>
      </Show>

      <Show when={props.rotationKeys.length > 0}>
        <section>
          <h3 class={HEADING_CLASS}>Rotation keys</h3>
          <div class="flex flex-col gap-1">
            <For each={props.rotationKeys}>
              {(key) => (
                <CopyValue
                  value={key.replace("did:key:", "")}
                  copy={key}
                  label={detectDidKeyType(key)}
                  mono
                  quiet
                />
              )}
            </For>
          </div>
        </section>
      </Show>

      <ExternalLink href={didDocumentUrl()}>DID document</ExternalLink>
    </div>
  );
};
