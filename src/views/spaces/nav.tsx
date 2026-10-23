import { useParams } from "@solidjs/router";
import { children, createResource, type JSX } from "solid-js";

import { resolveDidInfo } from "../../components/hover-card/did.jsx";
import { timestampFromRkey } from "../../components/repo/record-row.jsx";
import { type Stage, StageNav, useSchemaAction } from "../../components/repo/stage-nav.jsx";
import { AlphaBadge } from "../../components/ui/alpha-badge.jsx";
import { localDateFromTimestamp } from "../../lib/format.js";
import { makeSpaceCollectionPath, makeSpacePath, makeSpaceRepoPath } from "./context.jsx";

const resolveDidHandle = async (did: string) => {
  try {
    return (await resolveDidInfo(did)).handle;
  } catch {
    return undefined;
  }
};

export const SpacesNav = (props: { action?: JSX.Element }) => {
  const params = useParams();
  // Resolved once, so rebuilding the stages doesn't recreate the action (and reset its dialog).
  const action = children(() => props.action);
  const [authorityHandle] = createResource(() => params.spaceAuthority, resolveDidHandle);
  const [repoHandle] = createResource(() => params.spaceRepo, resolveDidHandle);
  const schemaAction = useSchemaAction(() => params.collection);
  const hasSpace = () => !!params.spaceAuthority && !!params.spaceType && !!params.skey;

  const stages = (): Stage[] => {
    const result: Stage[] = [
      {
        kind: "Spaces",
        label: "All spaces",
        badge: <AlphaBadge />,
        href: hasSpace() ? "/spaces" : undefined,
        trailing: action(),
      },
    ];
    if (!hasSpace()) return result;

    const authority = params.spaceAuthority!;
    const spaceType = params.spaceType!;
    const skey = params.skey!;
    result.push({
      kind: "Space",
      label: spaceType,
      detail: `${skey} · ${authorityHandle() ?? authority}`,
      detailHref: authorityHandle() ? `/at://${authority}` : undefined,
      href: params.spaceRepo ? makeSpacePath(authority, spaceType, skey) : undefined,
      copy: { label: "owner DID", value: authority },
    });

    const repo = params.spaceRepo;
    if (!repo) return result;
    result.push({
      kind: "Repo",
      label: repoHandle() ?? repo,
      detail: repoHandle() ? repo : undefined,
      detailHref: repoHandle() ? `/at://${repo}` : undefined,
      href: params.collection ? makeSpaceRepoPath(authority, spaceType, skey, repo) : undefined,
      copy: { label: "DID", value: repo },
    });

    const collection = params.collection;
    if (!collection) return result;
    result.push({
      kind: "Collection",
      label: collection,
      href: params.rkey
        ? makeSpaceCollectionPath(authority, spaceType, skey, repo, collection)
        : undefined,
      copy: { label: "NSID", value: collection },
      actions: [schemaAction()!],
    });

    if (!params.rkey) return result;
    const timestamp = timestampFromRkey(params.rkey);
    result.push({
      kind: "Record",
      label: params.rkey,
      detail: timestamp === undefined ? undefined : localDateFromTimestamp(timestamp),
      copy: { label: "record key", value: params.rkey },
    });
    return result;
  };

  return <StageNav stages={stages()} />;
};
