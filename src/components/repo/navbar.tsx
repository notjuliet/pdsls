import { useParams } from "@solidjs/router";
import { createEffect, createSignal } from "solid-js";

import { didDocCache } from "../../lib/api";
import { localDateFromTimestamp } from "../../lib/format";
import { timestampFromRkey } from "./record-row";
import { type Stage, StageNav, useSchemaAction } from "./stage-nav";

const [pds, setPDS] = createSignal<string>();
export { setPDS };

export const NavBar = () => {
  const params = useParams();
  const [handle, setHandle] = createSignal(params.repo);
  const missingPds = () => pds() === "Missing PDS";
  const schemaAction = useSchemaAction(() => params.collection);

  createEffect(() => {
    pds();
    if (!params.repo) return;
    const hdl =
      didDocCache[params.repo]?.alsoKnownAs
        ?.filter((alias) => alias.startsWith("at://"))[0]
        ?.split("at://")[1] ?? params.repo;
    setHandle(hdl);
  });

  const rkeyDate = () => {
    const timestamp = params.rkey ? timestampFromRkey(params.rkey) : undefined;
    return timestamp === undefined ? undefined : localDateFromTimestamp(timestamp);
  };

  const stages = (): Stage[] => {
    const host = pds() && !missingPds() ? pds() : undefined;
    const collectionUri = `at://${params.repo}/${params.collection}`;
    const result: Stage[] = [
      {
        kind: "PDS",
        label: pds() && (!missingPds() || params.repo?.startsWith("did:")) ? pds() : "",
        labelClass: missingPds() ? "text-red-500 dark:text-red-400" : undefined,
        href: params.repo && host ? `/${host}` : undefined,
        copy: host ? { label: "host", value: host } : undefined,
        actions: host
          ? [
              {
                label: "Firehose",
                icon: "lucide--rss",
                href: `/streams?type=firehose&instance=${encodeURIComponent(`wss://${host}`)}`,
              },
            ]
          : undefined,
      },
    ];

    if (params.repo) {
      const hasHandle = handle() !== params.repo;
      result.push({
        kind: "Repo",
        label: hasHandle ? handle() : params.repo,
        detail: hasHandle ? params.repo : undefined,
        href: params.collection ? `/at://${params.repo}` : undefined,
        copy: { label: "DID", value: params.repo },
        actions: [
          {
            label: "Jetstream",
            icon: "lucide--radio-tower",
            href: `/streams?type=jetstream&dids=${encodeURIComponent(params.repo)}`,
          },
        ],
      });
    }

    if (params.collection) {
      result.push({
        kind: "Collection",
        label: params.collection,
        href: params.rkey ? `/at://${params.repo}/${params.collection}` : undefined,
        copy: { label: "AT URI", value: collectionUri },
        actions: [
          schemaAction()!,
          {
            label: "Jetstream",
            icon: "lucide--radio-tower",
            href: `/streams?type=jetstream&collections=${encodeURIComponent(params.collection)}&dids=${encodeURIComponent(params.repo!)}`,
          },
        ],
      });
    }

    if (params.rkey) {
      result.push({
        kind: "Record",
        label: params.rkey,
        detail: rkeyDate(),
        copy: { label: "AT URI", value: `${collectionUri}/${params.rkey}` },
      });
    }

    return result;
  };

  return <StageNav stages={stages()} />;
};
