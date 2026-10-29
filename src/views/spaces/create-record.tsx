import { isRecordKey } from "@atcute/lexicons/syntax";
import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";

import { hasUserScope, SPACE_MANAGE_RECORDS_SCOPE_ID } from "../../auth/scope-utils.js";
import { RecordEditorDialog, type RecordWrite } from "../../components/create/editor-dialog.jsx";
import type { JSONType } from "../../components/json.jsx";
import { addNotification } from "../../components/ui/notification.jsx";
import { PermissionButton } from "../../components/ui/permission-button.jsx";
import {
  createSpaceRecord,
  putSpaceRecord,
  type SpaceRecordWriteResult,
} from "../../lib/spaces.js";
import { makeSpaceRecordPath, useSpaceRecords, useSpacesAuth } from "./context.jsx";

interface SpaceRecordEditorProps {
  authority: string;
  type: string;
  skey: string;
  space: string;
  collection?: string;
  rkey?: string;
  record?: JSONType;
  mode?: "create" | "edit";
  label?: string;
  onSaved?: (result: SpaceRecordWriteResult, record: JSONType) => void;
}

const initialRecord = (collection?: string, record?: JSONType) =>
  JSON.stringify(
    record ?? {
      $type: collection ?? "",
    },
    null,
    2,
  );

export const SpaceRecordEditor = (props: SpaceRecordEditorProps) => {
  const auth = useSpacesAuth();
  const navigate = useNavigate();
  const spaceRecords = useSpaceRecords();
  const [open, setOpen] = createSignal(false);
  const editing = () => props.mode === "edit";

  const submit = async (write: RecordWrite) => {
    const record = write.record as JSONType;
    const result =
      editing() && write.rkey
        ? await putSpaceRecord(
            auth(),
            props.space,
            auth().sub,
            write.collection,
            write.rkey,
            record,
            write.validate,
          )
        : await createSpaceRecord(
            auth(),
            props.space,
            write.collection,
            record,
            write.rkey,
            write.validate,
          );
    const uriPrefix = `${props.space}/${auth().sub}/${write.collection}/`;
    if (!result.uri.startsWith(uriPrefix)) {
      throw new Error("The PDS returned an invalid record URI");
    }
    const createdRkey = result.uri.slice(uriPrefix.length);
    if (!isRecordKey(createdRkey)) {
      throw new Error("The PDS returned an invalid record URI");
    }
    if (editing() && createdRkey !== write.rkey) {
      throw new Error("The PDS returned an unexpected record URI");
    }

    spaceRecords.invalidateRecords();
    props.onSaved?.(result, record);

    addNotification({
      message: editing() ? "Record updated" : "Record created",
      type: "success",
      duration: 3000,
    });

    if (!editing()) {
      navigate(
        makeSpaceRecordPath(
          props.authority,
          props.type,
          props.skey,
          auth().sub,
          write.collection,
          createdRkey,
        ),
      );
    }
  };

  return (
    <>
      <PermissionButton
        scope={SPACE_MANAGE_RECORDS_SCOPE_ID}
        tooltip={props.label ? undefined : editing() ? "Edit record" : "Create record"}
        class={
          props.label
            ? "flex items-center gap-1 rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs transition-colors hover:bg-neutral-200/50 active:bg-neutral-200 sm:px-2 sm:py-0.75 sm:text-sm dark:border-neutral-700 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
            : undefined
        }
        disabledClass={
          props.label
            ? "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs opacity-40 sm:px-2 sm:py-1 sm:text-sm"
            : undefined
        }
        onClick={() => setOpen(true)}
      >
        <span class={`iconify ${editing() ? "lucide--pencil" : "lucide--square-pen"}`} />
        <Show when={props.label}>{props.label}</Show>
      </PermissionButton>

      <RecordEditorDialog
        mode={editing() ? "edit" : "create"}
        open={open()}
        onClose={() => setOpen(false)}
        content={initialRecord(props.collection, props.record)}
        collection={props.collection}
        lockCollection={!!props.collection}
        rkey={props.rkey}
        uploadRepo={auth().sub}
        canUpload={hasUserScope("blob")}
        onSubmit={submit}
      />
    </>
  );
};
