import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";

import { SPACE_MANAGE_RECORDS_SCOPE_ID } from "../../auth/scope-utils";
import { Button } from "../../components/button.jsx";
import { CopyableInfoField } from "../../components/copyable-info-field.jsx";
import { JSONValue } from "../../components/json.jsx";
import { Modal } from "../../components/modal.jsx";
import { addNotification, removeNotification } from "../../components/notification.jsx";
import { PermissionButton } from "../../components/permission-button.jsx";
import { RecordSchemaValidation } from "../../components/record-schema-validation.jsx";
import Tooltip from "../../components/tooltip.jsx";
import {
  hasKnownRecordSchema,
  validateKnownRecordSchema,
  validateResolvedRecordSchema,
} from "../../lib/record-validation.js";
import { SchemaTabContent, useLexiconSchema } from "../../lib/schema-tab.jsx";
import {
  deleteSpaceRecord,
  getSpaceBlob,
  getSpaceRecord,
  type GetSpaceRecordResult,
} from "../../lib/spaces.js";
import { addToClipboard } from "../../utils/copy.js";
import {
  makeSpaceCollectionPath,
  makeSpaceRef,
  makeSpaceRecordPath,
  useSpaceRecords,
  useSpacesAuth,
} from "./context.jsx";
import { ErrorNotice, LoadingState } from "./shared.jsx";

export const SpaceRecordView = () => {
  const auth = useSpacesAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const spaceRecords = useSpaceRecords();
  const params = useParams();
  const [record, setRecord] = createSignal<GetSpaceRecordResult>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [openDelete, setOpenDelete] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [validSchema, setValidSchema] = createSignal<boolean>();
  const [validationError, setValidationError] = createSignal("");
  const [remoteValidation, setRemoteValidation] = createSignal(false);
  const lexicon = useLexiconSchema(() => params.collection);
  let requestVersion = 0;

  const space = () => makeSpaceRef(params.spaceAuthority!, params.spaceType!, params.skey!);
  const repo = () => params.spaceRepo!;
  const recordPath = () =>
    makeSpaceRecordPath(
      params.spaceAuthority!,
      params.spaceType!,
      params.skey!,
      repo(),
      params.collection!,
      params.rkey!,
    );

  createEffect(() => {
    requestVersion += 1;
    const version = requestVersion;
    setRecord(undefined);
    setError(undefined);
    setValidSchema(undefined);
    setValidationError("");
    setRemoteValidation(false);

    setLoading(true);
    void getSpaceRecord(auth(), space(), repo(), params.collection!, params.rkey!)
      .then((result) => {
        if (version === requestVersion) {
          setRecord(result);
          const validation = validateKnownRecordSchema(params.collection!, result.value);
          if (validation) {
            setValidSchema(validation.valid);
            setValidationError(validation.error ?? "");
          }
        }
      })
      .catch((err) => {
        if (version === requestVersion) {
          setError(err instanceof Error ? err.message : "Could not load the Space record");
        }
      })
      .finally(() => {
        if (version === requestVersion) setLoading(false);
      });
  });

  const validateRemoteSchema = async (value: unknown) => {
    try {
      setRemoteValidation(true);
      setValidationError("");
      await validateResolvedRecordSchema(params.collection!, params.rkey!, value);
      setValidSchema(true);
    } catch (err) {
      console.error("Schema validation error:", err);
      setValidSchema(false);
      setValidationError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemoteValidation(false);
    }
  };

  const deleteRecord = async () => {
    if (deleting() || repo() !== auth().sub) return;

    setDeleting(true);
    try {
      await deleteSpaceRecord(auth(), space(), repo(), params.collection!, params.rkey!);
      spaceRecords.invalidateRecords();
      setOpenDelete(false);

      const notification = addNotification({
        message: "Record deleted",
        type: "success",
      });
      setTimeout(() => removeNotification(notification), 3000);

      navigate(
        makeSpaceCollectionPath(
          params.spaceAuthority!,
          params.spaceType!,
          params.skey!,
          repo(),
          params.collection!,
        ),
      );
    } catch (err) {
      const notification = addNotification({
        message: err instanceof Error ? err.message : "Could not delete the Space record",
        type: "error",
      });
      setTimeout(() => removeNotification(notification), 5000);
    } finally {
      setDeleting(false);
    }
  };

  const RecordTab = (props: { tab: "record" | "schema" | "info"; label: string }) => {
    const active = () => {
      if (props.tab === "info") return location.hash === "#info";
      if (props.tab === "schema") return lexicon.showSchema();
      return location.hash !== "#info" && !lexicon.showSchema();
    };

    return (
      <A
        href={`${recordPath()}#${props.tab}`}
        classList={{
          "border-b-2 font-medium transition-colors": true,
          "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
            !active(),
        }}
      >
        {props.label}
      </A>
    );
  };

  return (
    <>
      <div class="flex w-full flex-col items-center py-2 pb-10">
        <Show when={loading()}>
          <LoadingState label="Loading record…" />
        </Show>

        <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

        <Show when={record()}>
          {(value) => (
            <div class="flex w-full flex-col items-center">
              <div class="mb-3 flex min-h-7 w-full items-center justify-between px-2 text-sm sm:text-base">
                <div class="flex items-center gap-3 sm:gap-4">
                  <RecordTab tab="record" label="Record" />
                  <RecordTab tab="schema" label="Schema" />
                  <RecordTab tab="info" label="Info" />
                </div>
                <div class="flex sm:gap-0.5">
                  <Show when={repo() === auth().sub}>
                    <PermissionButton
                      scope={SPACE_MANAGE_RECORDS_SCOPE_ID}
                      tooltip="Delete"
                      onClick={() => setOpenDelete(true)}
                    >
                      <span class="iconify lucide--trash-2" />
                    </PermissionButton>
                  </Show>
                  <Tooltip text="Copy record">
                    <button
                      type="button"
                      aria-label="Copy record"
                      class="flex items-center rounded-sm p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600"
                      onClick={() => addToClipboard(JSON.stringify(value().value, null, 2) ?? "")}
                    >
                      <span class="iconify lucide--copy" />
                    </button>
                  </Tooltip>
                </div>
              </div>

              <Show when={location.hash !== "#info" && !lexicon.showSchema()}>
                <div class="w-full max-w-screen min-w-full px-2 font-mono text-xs wrap-anywhere whitespace-pre-wrap sm:w-max sm:text-sm md:max-w-3xl">
                  <JSONValue
                    data={value().value}
                    repo={repo()}
                    newTab
                    fetchBlob={(cid) => getSpaceBlob(auth(), space(), repo(), cid)}
                  />
                </div>
              </Show>

              <Show when={lexicon.showSchema()}>
                <SchemaTabContent
                  schema={lexicon.schema()}
                  loading={lexicon.loading()}
                  error={lexicon.error()}
                  fallbackSchema={
                    params.collection === "com.atproto.lexicon.schema" ? value().value : undefined
                  }
                />
              </Show>

              <Show when={location.hash === "#info"}>
                <div class="flex w-full flex-col gap-3 px-2">
                  <CopyableInfoField label="AT URI" value={value().uri} />
                  <CopyableInfoField label="CID" value={value().cid} />
                  <RecordSchemaValidation
                    valid={validSchema()}
                    error={validationError()}
                    resolving={remoteValidation()}
                    canResolve={!!params.collection && !hasKnownRecordSchema(params.collection)}
                    onResolve={() => void validateRemoteSchema(value().value)}
                  />
                </div>
              </Show>
            </div>
          )}
        </Show>
      </div>

      <Modal
        open={openDelete()}
        onClose={() => !deleting() && setOpenDelete(false)}
        contentClass="dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-4 shadow-md dark:border-neutral-700"
      >
        <h2 class="font-semibold">Delete this record?</h2>
        <p class="mt-1 mb-3 text-sm text-neutral-600 dark:text-neutral-400">
          This cannot be undone.
        </p>
        <div class="flex justify-end gap-2">
          <Button disabled={deleting()} onClick={() => setOpenDelete(false)}>
            Cancel
          </Button>
          <Button
            disabled={deleting()}
            onClick={() => void deleteRecord()}
            classList={{
              "bg-red-500! border-none! text-white! hover:bg-red-400! active:bg-red-400! disabled:opacity-60": true,
            }}
          >
            <Show when={deleting()}>
              <span class="iconify lucide--loader-circle animate-spin" />
            </Show>
            {deleting() ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Modal>
    </>
  );
};
