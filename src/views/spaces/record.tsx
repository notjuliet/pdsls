import { useLocation, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createSignal, Show } from "solid-js";

import { SPACE_MANAGE_RECORDS_SCOPE_ID } from "../../auth/scope-utils";
import { JSONValue } from "../../components/json.jsx";
import {
  RecordInfo,
  RecordPage,
  recordTabFromHash,
  useRecordSchemaValidation,
} from "../../components/repo/record-page.jsx";
import { ConfirmDialog } from "../../components/ui/confirm-dialog.jsx";
import { IconButton } from "../../components/ui/icon-button.jsx";
import { addNotification } from "../../components/ui/notification.jsx";
import { ErrorNotice, LoadingState } from "../../components/ui/states.jsx";
import { addToClipboard } from "../../lib/copy.js";
import { SchemaTabContent, useLexiconSchema } from "../../lib/schema-tab.jsx";
import {
  deleteSpaceRecord,
  getSpaceBlob,
  getSpaceRecord,
  type GetSpaceRecordResult,
  verifySpaceRecord,
} from "../../lib/spaces.js";
import {
  makeSpaceBlobPath,
  makeSpaceCollectionPath,
  makeSpaceRef,
  makeSpaceRecordPath,
  useSpaceRecords,
  useSpacesAuth,
} from "./context.jsx";
import { SpaceRecordEditor } from "./create-record.jsx";

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
  const [validRecord, setValidRecord] = createSignal<boolean>();
  const [verifyError, setVerifyError] = createSignal("");
  const schemaValidation = useRecordSchemaValidation(
    () => params.collection!,
    () => params.rkey!,
  );
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

  const showRecord = (result: GetSpaceRecordResult) => {
    setRecord(result);
    void schemaValidation.validate(result.value);
  };

  createEffect(() => {
    requestVersion += 1;
    const version = requestVersion;
    setRecord(undefined);
    setError(undefined);
    schemaValidation.reset();
    setValidRecord(undefined);
    setVerifyError("");

    setLoading(true);
    void getSpaceRecord(auth(), space(), repo(), params.collection!, params.rkey!)
      .then((result) => {
        if (version === requestVersion) {
          showRecord(result);
          void verifyRecordIntegrity(result, version);
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

  const verifyRecordIntegrity = async (result: GetSpaceRecordResult, version: number) => {
    try {
      await verifySpaceRecord(auth(), space(), repo(), params.collection!, params.rkey!, result);
      if (version === requestVersion) setValidRecord(true);
    } catch (err) {
      console.error("Record verification error:", err);
      if (version === requestVersion) {
        setVerifyError(err instanceof Error ? err.message : String(err));
        setValidRecord(false);
      }
    }
  };

  const deleteRecord = async () => {
    if (deleting() || repo() !== auth().sub) return;

    setDeleting(true);
    try {
      await deleteSpaceRecord(auth(), space(), repo(), params.collection!, params.rkey!);
      spaceRecords.invalidateRecords();
      setOpenDelete(false);

      addNotification({
        message: "Record deleted",
        type: "success",
        duration: 3000,
      });

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
      addNotification({
        message: err instanceof Error ? err.message : "Could not delete the Space record",
        type: "error",
        duration: 5000,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div class="flex w-full flex-col items-center py-2 pb-10">
        <Show when={loading()}>
          <LoadingState label="Loading record…" />
        </Show>

        <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

        <Show when={record()} keyed>
          {(value) => (
            <RecordPage
              tabs={[
                { id: "record", label: "Record" },
                { id: "schema", label: "Schema" },
                {
                  id: "info",
                  label: "Info",
                  error: validRecord() === false || schemaValidation.valid() === false,
                  loading: schemaValidation.resolving(),
                },
              ]}
              activeTab={recordTabFromHash(location.hash)}
              tabHref={(tab) => `${recordPath()}#${tab}`}
              actions={
                <>
                  <Show when={repo() === auth().sub}>
                    <SpaceRecordEditor
                      authority={params.spaceAuthority!}
                      type={params.spaceType!}
                      skey={params.skey!}
                      space={space()}
                      collection={params.collection!}
                      rkey={params.rkey!}
                      record={value.value}
                      mode="edit"
                      onSaved={(result, updatedRecord) => {
                        // A saved record wasn't fetched with a MAC, so it can't be checked.
                        requestVersion += 1;
                        setValidRecord(undefined);
                        setVerifyError("");
                        showRecord({ ...result, value: updatedRecord });
                      }}
                    />
                    <IconButton
                      icon="lucide--trash-2"
                      label="Delete"
                      scope={SPACE_MANAGE_RECORDS_SCOPE_ID}
                      onClick={() => setOpenDelete(true)}
                    />
                  </Show>
                  <IconButton
                    icon="lucide--copy"
                    label="Copy record"
                    onClick={() => addToClipboard(JSON.stringify(value.value, null, 2))}
                  />
                </>
              }
              record={
                <JSONValue
                  data={value.value}
                  repo={repo()}
                  newTab
                  fetchBlob={(cid) => getSpaceBlob(auth(), space(), repo(), cid)}
                  blobHref={(cid) =>
                    makeSpaceBlobPath(
                      params.spaceAuthority!,
                      params.spaceType!,
                      params.skey!,
                      repo(),
                      cid,
                    )
                  }
                  schema={params.collection}
                  issues={schemaValidation.issues()}
                />
              }
              schema={
                <SchemaTabContent
                  schema={lexicon.schema()}
                  loading={lexicon.loading()}
                  error={lexicon.error()}
                  fallbackSchema={
                    params.collection === "com.atproto.lexicon.schema" ? value.value : undefined
                  }
                />
              }
              info={
                <RecordInfo
                  uri={value.uri}
                  cid={value.cid}
                  verification={
                    value.mac ? { valid: validRecord(), error: verifyError() } : undefined
                  }
                  schema={schemaValidation}
                />
              }
            />
          )}
        </Show>
      </div>

      <ConfirmDialog
        open={openDelete()}
        onClose={() => setOpenDelete(false)}
        onConfirm={() => void deleteRecord()}
        title="Delete this record?"
        description="This cannot be undone."
        confirmLabel={deleting() ? "Deleting…" : "Delete"}
        busy={deleting()}
      />
    </>
  );
};
