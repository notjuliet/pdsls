import { useParams } from "@solidjs/router";
import { children, createResource, type JSX, Show } from "solid-js";

import { resolveDidInfo } from "../../components/hover-card/did.jsx";
import { timestampFromRkey } from "../../components/repo/record-row.jsx";
import { nsidDomain, type Stage, StageNav } from "../../components/repo/stage-nav.jsx";
import { BackLink } from "../../components/ui/back-link.jsx";
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
  const hasSpace = () => !!params.spaceAuthority && !!params.spaceType && !!params.skey;

  const stages = (): Stage[] => {
    // The spaces list is the root: its own page shows it as the only row, deeper pages link back above.
    if (!hasSpace()) return [{ label: "All spaces", trailing: action() }];
    const result: Stage[] = [];

    const authority = params.spaceAuthority!;
    const spaceType = params.spaceType!;
    const skey = params.skey!;
    result.push({
      kind: "Space",
      // Type and key identify the space, shown like the spaces list does; the owner is the detail.
      label: (
        <>
          {spaceType}
          <span class="font-normal text-neutral-400 dark:text-neutral-500"> / </span>
          {skey}
        </>
      ),
      favicon: nsidDomain(spaceType),
      detail: authorityHandle() ?? authority,
      href: params.spaceRepo ? makeSpacePath(authority, spaceType, skey) : undefined,
      copy: { label: "owner DID", value: authority },
    });

    const repo = params.spaceRepo;
    if (!repo) return result;
    // A member's records within the space, not their whole repo.
    result.push({
      kind: "Member",
      label: repoHandle() ?? repo,
      detail: repoHandle() ? repo : undefined,
      href: params.collection ? makeSpaceRepoPath(authority, spaceType, skey, repo) : undefined,
      copy: { label: "DID", value: repo },
    });

    const collection = params.collection;
    if (!collection) return result;
    result.push({
      kind: "Collection",
      label: collection,
      favicon: nsidDomain(collection),
      href: params.rkey
        ? makeSpaceCollectionPath(authority, spaceType, skey, repo, collection)
        : undefined,
      copy: { label: "NSID", value: collection },
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

  return (
    <div class="flex w-full flex-col">
      <Show when={hasSpace()}>
        <BackLink href="/spaces">All spaces</BackLink>
      </Show>
      <StageNav stages={stages()} />
    </div>
  );
};
