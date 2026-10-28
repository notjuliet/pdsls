import { createSignal, type JSX, Match, Show, Switch } from "solid-js";

import {
  hasKnownRecordSchema,
  validateKnownRecordSchema,
  validateResolvedRecordSchema,
} from "../../lib/record-validation.js";
import { ExternalLink } from "../ui/external-link.jsx";
import { CopyValue, InfoRow, InfoSection, MUTED_CLASS, UNDER_VALUE_CLASS } from "../ui/info.jsx";
import { Tabs } from "../ui/tabs.jsx";

export type RecordTab = "record" | "schema" | "backlinks" | "info";

/** The tab a record page's URL hash points at, e.g. `#schema:main` or `#backlinks:…`. */
export const recordTabFromHash = (hash: string): RecordTab => {
  if (hash === "#schema" || hash.startsWith("#schema:")) return "schema";
  if (hash === "#backlinks" || hash.startsWith("#backlinks:")) return "backlinks";
  if (hash === "#info") return "info";
  return "record";
};

interface RecordPageProps {
  tabs: { id: RecordTab; label: string; error?: boolean }[];
  activeTab: RecordTab;
  tabHref: (tab: RecordTab) => string;
  actions?: JSX.Element;
  record: JSX.Element;
  schema: JSX.Element;
  backlinks?: JSX.Element;
  info: JSX.Element;
}

export const RecordPage = (props: RecordPageProps) => {
  // Falls back to the record when the hash names a tab this page doesn't have, e.g. an old #schema link.
  const activeTab = () =>
    props.tabs.some((tab) => tab.id === props.activeTab) ? props.activeTab : "record";

  return (
    <div class="flex w-full flex-col items-center">
      <div class="mb-5 flex min-h-7 w-full items-center justify-between pl-2 text-sm sm:text-base">
        <Tabs
          items={props.tabs.map((tab) => ({ ...tab, href: props.tabHref(tab.id) }))}
          active={activeTab()}
        />
        <div class="flex sm:gap-0.5">{props.actions}</div>
      </div>

      <Switch>
        <Match when={activeTab() === "record"}>
          <div class="w-full px-2 font-mono text-xs wrap-anywhere whitespace-pre-wrap sm:text-sm">
            {props.record}
          </div>
        </Match>
        <Match when={activeTab() === "schema"}>{props.schema}</Match>
        <Match when={activeTab() === "backlinks"}>{props.backlinks}</Match>
        <Match when={activeTab() === "info"}>
          <div class="w-full px-2">{props.info}</div>
        </Match>
      </Switch>
    </div>
  );
};

/** Schema validation state for a record page: known schemas check locally, others on request. */
export const useRecordSchemaValidation = (collection: () => string, rkey: () => string) => {
  const [valid, setValid] = createSignal<boolean>();
  const [error, setError] = createSignal("");
  const [resolving, setResolving] = createSignal(false);

  const reset = () => {
    setValid(undefined);
    setError("");
    setResolving(false);
  };

  const validateLocal = (value: unknown) => {
    reset();
    const result = validateKnownRecordSchema(collection(), value);
    if (!result) return;
    setValid(result.valid);
    setError(result.error ?? "");
  };

  const validateRemote = async (value: unknown) => {
    try {
      setResolving(true);
      setError("");
      await validateResolvedRecordSchema(collection(), rkey(), value);
      setValid(true);
    } catch (err) {
      console.error("Schema validation error:", err);
      setValid(false);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResolving(false);
    }
  };

  return {
    valid,
    error,
    resolving,
    canResolve: () => !hasKnownRecordSchema(collection()),
    reset,
    validateLocal,
    validateRemote,
  };
};

export type RecordSchemaValidationState = ReturnType<typeof useRecordSchemaValidation>;

/**
 * A check and its result: a spinner while it runs, then a check or a cross and, if it failed,
 * why. Before it has run, `onCheck` offers to run it in place of "Not checked".
 */
const CheckRow = (props: {
  label: string;
  valid: boolean | undefined;
  error: string;
  running: boolean;
  onCheck?: () => void;
}) => (
  <div class="flex flex-col gap-1">
    <InfoRow label={props.label} center>
      <span class="flex items-center">
        <Switch
          fallback={
            <Show when={props.onCheck} fallback={<span class={MUTED_CLASS}>Not checked</span>}>
              {(onCheck) => (
                <button
                  type="button"
                  class="rounded-md border border-neutral-300 px-1.5 text-xs leading-5 transition-colors hover:bg-neutral-200/50 active:bg-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                  onClick={() => onCheck()()}
                >
                  Resolve and check
                </button>
              )}
            </Show>
          }
        >
          <Match when={props.valid === true}>
            <span
              role="img"
              aria-label="Valid"
              title="Valid"
              class="iconify lucide--check text-green-600 dark:text-green-400"
            />
          </Match>
          <Match when={props.valid === false}>
            <span
              role="img"
              aria-label="Invalid"
              title="Invalid"
              class="iconify lucide--x text-red-500 dark:text-red-400"
            />
          </Match>
          <Match when={props.running}>
            <span
              role="img"
              aria-label="Checking"
              title="Checking"
              class={`iconify lucide--loader-circle animate-spin ${MUTED_CLASS}`}
            />
          </Match>
        </Switch>
      </span>
    </InfoRow>
    <Show when={props.valid === false && props.error}>
      <p class={`${UNDER_VALUE_CLASS} text-xs wrap-break-word text-red-500 dark:text-red-400`}>
        {props.error}
      </p>
    </Show>
  </div>
);

/** The Info tab: the record's identifiers and how far it has been checked. */
export const RecordInfo = (props: {
  uri: string;
  cid?: string;
  /** Where the raw record can be fetched, e.g. its getRecord URL on the PDS. */
  rawHref?: string;
  /** Omitted when the source offers no way to verify the record. */
  verification?: { valid: boolean | undefined; error: string };
  schema: RecordSchemaValidationState;
  value: unknown;
}) => (
  <div class="flex flex-col gap-4 wrap-anywhere">
    {/* Headed like Identity's DID, so the long values get the full width. */}
    <InfoSection title="AT URI">
      <CopyValue value={props.uri} />
    </InfoSection>
    <Show when={props.cid}>
      {(cid) => (
        <InfoSection title="CID">
          <CopyValue value={cid()} />
        </InfoSection>
      )}
    </Show>
    <InfoSection title="Validation">
      <div class="flex flex-col gap-1">
        <Show when={props.verification}>
          {(verification) => (
            <CheckRow
              label="Record"
              valid={verification().valid}
              error={verification().error}
              running
            />
          )}
        </Show>
        <CheckRow
          label="Schema"
          valid={props.schema.valid()}
          error={props.schema.error()}
          running={props.schema.resolving()}
          onCheck={
            props.schema.canResolve()
              ? () => void props.schema.validateRemote(props.value)
              : undefined
          }
        />
      </div>
    </InfoSection>
    <Show when={props.rawHref}>
      {(href) => <ExternalLink href={href()}>Open on PDS</ExternalLink>}
    </Show>
  </div>
);
