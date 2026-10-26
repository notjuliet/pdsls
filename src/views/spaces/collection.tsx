import { type RouteSectionProps, useParams } from "@solidjs/router";
import { Show } from "solid-js";

import { SPACE_MANAGE_RECORDS_SCOPE_ID } from "../../auth/scope-utils";
import { CollectionPage, type CollectionSource } from "../../components/repo/collection-page.jsx";
import { NestedLayout } from "../../components/ui/nested-layout.jsx";
import { deleteSpaceRecords, listSpaceRecords } from "../../lib/spaces.js";
import {
  makeSpaceCollectionPath,
  makeSpaceRecordPath,
  makeSpaceRef,
  useSpaceRecords,
  useSpacesAuth,
} from "./context.jsx";
import { SpaceRecordEditor } from "./create-record.jsx";

const SpaceCollectionView = () => {
  const auth = useSpacesAuth();
  const spaceRecords = useSpaceRecords();
  const params = useParams();
  const repo = () => params.spaceRepo!;
  const space = () => makeSpaceRef(params.spaceAuthority!, params.spaceType!, params.skey!);

  const source = (): CollectionSource => {
    const collection = params.collection!;
    return {
      key: `${auth().sub}\n${space()}\n${repo()}\n${collection}\n${spaceRecords.recordsVersion()}`,
      repo: repo(),
      collection,
      collectionHref: makeSpaceCollectionPath(
        params.spaceAuthority!,
        params.spaceType!,
        params.skey!,
        repo(),
        collection,
      ),
      recordHref: (rkey) =>
        makeSpaceRecordPath(
          params.spaceAuthority!,
          params.spaceType!,
          params.skey!,
          repo(),
          collection,
          rkey,
        ),
      listRecords: async ({ cursor, limit, reverse }) => {
        const result = await listSpaceRecords(auth(), space(), repo(), {
          collection,
          cursor,
          limit,
          reverse,
        });
        return {
          records: result.records.map((record) => ({
            rkey: record.rkey,
            cid: record.cid,
            value: record.value,
          })),
          cursor: result.cursor,
        };
      },
      manage:
        repo() === auth().sub
          ? {
              scope: SPACE_MANAGE_RECORDS_SCOPE_ID,
              deleteRecords: async (records) => {
                try {
                  await deleteSpaceRecords(
                    auth(),
                    space(),
                    repo(),
                    records.map((record) => ({ collection, rkey: record.rkey })),
                  );
                } finally {
                  spaceRecords.invalidateRecords();
                }
              },
            }
          : undefined,
    };
  };

  return (
    // Same top spacing as the Spaces record page; none while a record is open over it.
    <div class="w-full" classList={{ "pt-2": !params.rkey }}>
      <CollectionPage
        source={source()}
        hidden={!!params.rkey}
        actions={
          <Show when={repo() === auth().sub}>
            <SpaceRecordEditor
              authority={params.spaceAuthority!}
              type={params.spaceType!}
              skey={params.skey!}
              space={space()}
              collection={params.collection!}
            />
          </Show>
        }
      />
    </div>
  );
};

export const SpaceCollectionLayout = (props: RouteSectionProps) => {
  const params = useParams();
  const hasChild = () => !!params.rkey;
  const key = () =>
    `${params.spaceAuthority}/${params.spaceType}/${params.skey}/${params.spaceRepo}/${params.collection}`;

  return (
    <NestedLayout key={key()} hasChild={hasChild()} view={() => <SpaceCollectionView />}>
      {props.children}
    </NestedLayout>
  );
};
