import { Client, simpleFetchHandler } from "@atcute/client";
import { useParams } from "@solidjs/router";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

import { didDocCache, getPDS } from "../../lib/api";
import { localDateFromTimestamp } from "../../lib/format";
import { setPageStreams } from "../../lib/page-streams";
import { timestampFromRkey } from "./record-row";
import { nsidDomain, type Stage, StageNav } from "./stage-nav";

const [pds, setPDS] = createSignal<string>();
export { setPDS };

/** The pronouns on a repo's Bluesky profile record, if it has any. */
const fetchPronouns = async (did: `did:${string}:${string}`) => {
  const rpc = new Client({ handler: simpleFetchHandler({ service: await getPDS(did) }) });
  const res = await rpc.get("com.atproto.repo.getRecord", {
    params: { repo: did, collection: "app.bsky.actor.profile", rkey: "self" },
  });
  const pronouns = res.ok ? (res.data.value as { pronouns?: unknown }).pronouns : undefined;
  return typeof pronouns === "string" ? pronouns.trim() || undefined : undefined;
};

export const NavBar = () => {
  const params = useParams();
  const [handle, setHandle] = createSignal(params.repo);
  const [pronouns, setPronouns] = createSignal<string>();
  const missingPds = () => pds() === "Missing PDS";

  createEffect(() => {
    pds();
    if (!params.repo) return;
    const hdl =
      didDocCache[params.repo]?.alsoKnownAs
        ?.filter((alias) => alias.startsWith("at://"))[0]
        ?.split("at://")[1] ?? params.repo;
    setHandle(hdl);
  });

  createEffect(() => {
    const repo = params.repo;
    setPronouns(undefined);
    if (!repo?.startsWith("did:")) return;
    let stale = false;
    onCleanup(() => (stale = true));
    fetchPronouns(repo as `did:${string}:${string}`)
      .then((value) => !stale && setPronouns(value))
      .catch(() => {});
  });

  // Offer this page's streams in the search dropdown, the deepest level first.
  createEffect(() => {
    const host = pds() && !missingPds() ? pds() : undefined;
    const repo = params.repo;
    const collection = params.collection;
    const recordUri =
      repo && collection && params.rkey ? `at://${repo}/${collection}/${params.rkey}` : undefined;
    setPageStreams({
      firehose: host
        ? {
            href: `/streams?type=firehose&instance=${encodeURIComponent(`wss://${host}`)}`,
            target: host,
          }
        : undefined,
      jetstream: repo
        ? {
            href: `/streams?type=jetstream${collection ? `&collections=${encodeURIComponent(collection)}` : ""}&dids=${encodeURIComponent(repo)}`,
            target: collection ?? handle() ?? repo,
          }
        : undefined,
      // Spacedust streams links pointing at something: the open record, else the repo's account.
      spacedust: recordUri
        ? {
            href: `/streams?type=spacedust&subjects=${encodeURIComponent(recordUri)}`,
            target: params.rkey!,
          }
        : repo
          ? {
              href: `/streams?type=spacedust&subjectDids=${encodeURIComponent(repo)}`,
              target: handle() ?? repo,
            }
          : undefined,
    });
  });
  onCleanup(() => setPageStreams({}));

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
      },
    ];

    if (params.repo) {
      const hasHandle = handle() !== params.repo;
      result.push({
        kind: "Repo",
        label: hasHandle ? handle() : params.repo,
        detail:
          pronouns() || hasHandle ? (
            <span class="flex gap-x-2">
              <Show when={pronouns()}>
                <span class="shrink-0">{pronouns()}</span>
              </Show>
              <Show when={hasHandle}>
                <span class="truncate">{params.repo}</span>
              </Show>
            </span>
          ) : undefined,
        href: params.collection ? `/at://${params.repo}` : undefined,
        copy: { label: "DID", value: params.repo },
      });
    }

    if (params.collection) {
      result.push({
        kind: "Collection",
        label: params.collection,
        favicon: nsidDomain(params.collection),
        href: params.rkey ? `/at://${params.repo}/${params.collection}` : undefined,
        copy: { label: "AT URI", value: collectionUri },
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
