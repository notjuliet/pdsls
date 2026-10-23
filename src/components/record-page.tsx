import { createSignal, type JSX, Match, Show, Switch } from "solid-js";

import {
  hasKnownRecordSchema,
  validateKnownRecordSchema,
  validateResolvedRecordSchema,
} from "../lib/record-validation.js";
import { CopyableInfoField } from "./copyable-info-field.jsx";
import { RecordSchemaValidation } from "./record-schema-validation.jsx";
import { RecordVerification } from "./record-verification.jsx";
import { Tabs } from "./tabs.jsx";

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

export const RecordPage = (props: RecordPageProps) => (
  <div class="flex w-full flex-col items-center">
    <div class="mb-3 flex min-h-7 w-full items-center justify-between px-2 text-sm sm:text-base">
      <Tabs
        items={props.tabs.map((tab) => ({ ...tab, href: props.tabHref(tab.id) }))}
        active={props.activeTab}
      />
      <div class="flex sm:gap-0.5">{props.actions}</div>
    </div>

    <Switch>
      <Match when={props.activeTab === "record"}>
        <div class="w-full max-w-screen min-w-full px-2 font-mono text-xs wrap-anywhere whitespace-pre-wrap sm:w-max sm:text-sm md:max-w-3xl">
          {props.record}
        </div>
      </Match>
      <Match when={props.activeTab === "schema"}>{props.schema}</Match>
      <Match when={props.activeTab === "backlinks"}>{props.backlinks}</Match>
      <Match when={props.activeTab === "info"}>
        <div class="flex w-full flex-col gap-3 px-2">{props.info}</div>
      </Match>
    </Switch>
  </div>
);

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

/** The Info tab: the record's identifiers and how far it has been checked. */
export const RecordInfo = (props: {
  uri: string;
  cid?: string;
  /** Omitted when the source offers no way to verify the record. */
  verification?: { valid: boolean | undefined; error: string };
  schema: RecordSchemaValidationState;
  value: unknown;
}) => (
  <>
    <CopyableInfoField label="AT URI" value={props.uri} />
    <Show when={props.cid}>{(cid) => <CopyableInfoField label="CID" value={cid()} />}</Show>
    <Show when={props.verification}>
      {(verification) => (
        <RecordVerification valid={verification().valid} error={verification().error} />
      )}
    </Show>
    <RecordSchemaValidation
      valid={props.schema.valid()}
      error={props.schema.error()}
      resolving={props.schema.resolving()}
      canResolve={props.schema.canResolve()}
      onResolve={() => void props.schema.validateRemote(props.value)}
    />
  </>
);
