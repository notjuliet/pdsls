import type { Issue } from "@atcute/lexicons/validations";
import { createComputed, createSignal, type JSX, Match, Show, Switch } from "solid-js";

import {
  isLexiconRecord,
  prefetchRecordLexicons,
  validateLexiconRecord,
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
  tabs: { id: RecordTab; label: string; error?: boolean; loading?: boolean }[];
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

/**
 * Schema validation state for a record page. Bundled schemas check at once; others are resolved
 * first, and a record whose lexicon can't be found is left unchecked rather than marked invalid.
 */
export const useRecordSchemaValidation = (collection: () => string, rkey: () => string) => {
  const [valid, setValid] = createSignal<boolean>();
  const [error, setError] = createSignal("");
  const [issues, setIssues] = createSignal<readonly Issue[]>([]);
  const [resolving, setResolving] = createSignal(false);
  /** Why the record couldn't be checked, e.g. its lexicon isn't published. */
  const [unavailable, setUnavailable] = createSignal("");
  // Counts checks, so one that finishes after the record changed doesn't overwrite the newer one.
  let run = 0;

  // The collection is known from the URL, well before its record loads. A computation rather
  // than an effect, since a page loading under Suspense holds its effects until it's done.
  createComputed(() => prefetchRecordLexicons(collection()));

  const reset = () => {
    run++;
    setValid(undefined);
    setError("");
    setIssues([]);
    setResolving(false);
    setUnavailable("");
  };

  const apply = (result: { valid: boolean; error?: string; issues?: readonly Issue[] }) => {
    setValid(result.valid);
    setError(result.error ?? "");
    setIssues(result.issues ?? []);
  };

  const validate = async (value: unknown) => {
    reset();
    if (isLexiconRecord(collection())) {
      apply(validateLexiconRecord(value));
      return;
    }

    const current = run;
    setResolving(true);
    try {
      const result = await validateResolvedRecordSchema(collection(), rkey(), value);
      if (current === run) apply(result);
    } catch (err) {
      if (current === run) setUnavailable(err instanceof Error ? err.message : String(err));
    } finally {
      if (current === run) setResolving(false);
    }
  };

  return {
    valid,
    error,
    /** What's wrong with the record, field by field, once it has been checked. */
    issues,
    resolving,
    unavailable,
    reset,
    validate,
  };
};

export type RecordSchemaValidationState = ReturnType<typeof useRecordSchemaValidation>;

/**
 * A check and its result: a spinner while it runs, then a check or a cross and, if it failed,
 * why. `unchecked` says why it couldn't run, e.g. there's no lexicon to check against.
 */
const CheckRow = (props: {
  label: string;
  valid: boolean | undefined;
  error: string;
  running: boolean;
  unchecked?: string;
}) => (
  <div class="flex flex-col gap-1">
    <InfoRow label={props.label} center>
      <span class="flex items-center">
        <Switch fallback={<span class={MUTED_CLASS}>Not checked</span>}>
          <Match when={props.valid === undefined && !props.running && props.unchecked}>
            {(reason) => (
              <span class={MUTED_CLASS} title={reason()}>
                No published lexicon
              </span>
            )}
          </Match>
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
          unchecked={props.schema.unavailable()}
        />
      </div>
    </InfoSection>
    <Show when={props.rawHref}>
      {(href) => <ExternalLink href={href()}>Open on PDS</ExternalLink>}
    </Show>
  </div>
);
