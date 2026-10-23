import { ComAtprotoRepoApplyWrites } from "@atcute/atproto";
import { Client } from "@atcute/client";
import { $type, ActorIdentifier } from "@atcute/lexicons";
import { type RouteSectionProps, useParams } from "@solidjs/router";

import { agent } from "../auth/state";
import { CollectionPage, type CollectionSource } from "../components/collection-page.jsx";
import type { JSONType } from "../components/json.jsx";
import { NestedLayout } from "../components/nested-layout.jsx";
import { useRepo } from "../lib/repo-context.jsx";

const APPLY_WRITES_BATCH_SIZE = 200;

export const CollectionLayout = (props: RouteSectionProps) => {
  const params = useParams();
  const hasChild = () => !!params.rkey;
  return (
    <NestedLayout
      key={`${params.repo}/${params.collection}`}
      hasChild={hasChild()}
      view={() => <CollectionView />}
    >
      {props.children}
    </NestedLayout>
  );
};

const CollectionView = () => {
  const repo = useRepo();
  const params = useParams();
  const hidden = () => !!params.rkey;
  const did = repo.did();

  const source = (): CollectionSource => {
    const collection = params.collection as `${string}.${string}.${string}`;
    return {
      key: `${did}/${collection}`,
      repo: did,
      collection,
      collectionHref: `/at://${did}/${collection}`,
      recordHref: (rkey) => `/at://${did}/${collection}/${rkey}`,
      listRecords: async ({ cursor, limit, reverse }) => {
        const res = await repo.rpc()!.get("com.atproto.repo.listRecords", {
          params: { repo: did as ActorIdentifier, collection, limit, cursor, reverse },
        });
        if (!res.ok) throw new Error(res.data.error);
        return {
          records: res.data.records.map((record) => ({
            rkey: record.uri.split("/").pop()!,
            cid: record.cid,
            value: record.value as JSONType,
          })),
          cursor: res.data.records.length < limit ? undefined : res.data.cursor,
        };
      },
      manage:
        agent()?.sub === did
          ? {
              scope: "delete",
              recreateScope: "create",
              deleteRecords: async (records, { recreate }) => {
                const writes: Array<
                  | $type.enforce<ComAtprotoRepoApplyWrites.Delete>
                  | $type.enforce<ComAtprotoRepoApplyWrites.Create>
                > = records.flatMap((record) => [
                  {
                    $type: "com.atproto.repo.applyWrites#delete" as const,
                    collection,
                    rkey: record.rkey,
                  },
                  ...(recreate
                    ? [
                        {
                          $type: "com.atproto.repo.applyWrites#create" as const,
                          collection,
                          rkey: record.rkey,
                          value: record.value as Record<string, unknown>,
                        },
                      ]
                    : []),
                ]);
                const authRpc = new Client({ handler: agent()! });
                for (let i = 0; i < writes.length; i += APPLY_WRITES_BATCH_SIZE) {
                  await authRpc.post("com.atproto.repo.applyWrites", {
                    input: {
                      repo: agent()!.sub,
                      writes: writes.slice(i, i + APPLY_WRITES_BATCH_SIZE),
                    },
                  });
                }
              },
            }
          : undefined,
    };
  };

  if (!hidden()) document.title = `${params.collection} - PDSls`;

  return (
    <CollectionPage
      source={source()}
      hidden={hidden() || !repo.rpc()}
      tabs={[
        {
          id: "jetstream",
          label: "Jetstream",
          href: `/streams?type=jetstream&collections=${encodeURIComponent(params.collection!)}&dids=${encodeURIComponent(params.repo!)}`,
        },
      ]}
    />
  );
};
