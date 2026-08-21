import { useParams } from "@solidjs/router";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

import { JSONValue } from "../../components/json.jsx";
import { getSpaceBlob, getSpaceRecord, type GetSpaceRecordResult } from "../../lib/spaces.js";
import { makeSpaceRef, useSpaceRecordMetadata, useSpacesAuth } from "./context.jsx";
import { ErrorNotice, LoadingState } from "./shared.jsx";

export const SpaceRecordView = () => {
  const auth = useSpacesAuth();
  const recordMetadata = useSpaceRecordMetadata();
  const params = useParams();
  const [record, setRecord] = createSignal<GetSpaceRecordResult>();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let requestVersion = 0;

  const space = () => makeSpaceRef(params.spaceAuthority!, params.spaceType!, params.skey!);

  createEffect(() => {
    requestVersion += 1;
    const version = requestVersion;
    setRecord(undefined);
    recordMetadata.setCid(undefined);
    setError(undefined);

    setLoading(true);
    void getSpaceRecord(auth(), space(), auth().sub, params.collection!, params.rkey!)
      .then((result) => {
        if (version === requestVersion) {
          setRecord(result);
          recordMetadata.setCid(result.cid);
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

  onCleanup(() => recordMetadata.setCid(undefined));

  return (
    <div class="flex w-full flex-col items-center gap-3 py-2 pb-10">
      <Show when={loading()}>
        <LoadingState label="Loading record…" />
      </Show>

      <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

      <Show when={record()}>
        {(value) => (
          <div class="w-full max-w-screen min-w-full px-2 font-mono text-xs wrap-anywhere whitespace-pre-wrap sm:w-max sm:text-sm md:max-w-3xl">
            <JSONValue
              data={value().value}
              repo={auth().sub}
              newTab
              fetchBlob={(cid) => getSpaceBlob(auth(), space(), auth().sub, cid)}
            />
          </div>
        )}
      </Show>
    </div>
  );
};
