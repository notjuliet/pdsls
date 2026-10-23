import { useParams } from "@solidjs/router";
import { createResource, type JSX, Show } from "solid-js";

import { BreadcrumbRow, Breadcrumbs } from "../../components/breadcrumbs.jsx";
import { Favicon } from "../../components/favicon.jsx";
import { resolveDidInfo } from "../../components/hover-card/did.jsx";
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
  const [authorityHandle] = createResource(() => params.spaceAuthority, resolveDidHandle);
  const [repoHandle] = createResource(() => params.spaceRepo, resolveDidHandle);
  const hasSpace = () => !!params.spaceAuthority && !!params.spaceType && !!params.skey;
  const spacePath = () =>
    hasSpace() ? makeSpacePath(params.spaceAuthority!, params.spaceType!, params.skey!) : undefined;
  const repoPath = () =>
    spacePath() && params.spaceRepo
      ? makeSpaceRepoPath(params.spaceAuthority!, params.spaceType!, params.skey!, params.spaceRepo)
      : undefined;
  const collectionPath = () =>
    repoPath() && params.collection
      ? makeSpaceCollectionPath(
          params.spaceAuthority!,
          params.spaceType!,
          params.skey!,
          params.spaceRepo!,
          params.collection,
        )
      : undefined;

  return (
    <Breadcrumbs>
      <div class="flex min-w-0 items-center gap-1">
        <div class="min-w-0 flex-1">
          <BreadcrumbRow
            icon="lucide--lock-keyhole"
            label="Spaces"
            href={hasSpace() ? "/spaces" : undefined}
            trailing={
              <span class="ml-auto shrink-0 rounded-md border border-yellow-600 px-1.5 py-0.5 text-[8px] font-medium tracking-wide text-yellow-600 uppercase sm:text-[9px] dark:border-amber-400 dark:text-amber-400">
                Alpha
              </span>
            }
          />
        </div>
        <Show when={props.action}>
          <div class="shrink-0">{props.action}</div>
        </Show>
      </div>

      <Show when={hasSpace()}>
        <BreadcrumbRow
          leading={<Favicon domain={params.spaceType!.split(".").slice(0, 2).join(".")} reverse />}
          label={params.spaceType}
          detailPrefix={`${params.skey} ·`}
          detail={authorityHandle() ?? params.spaceAuthority}
          detailHref={authorityHandle() ? `/at://${params.spaceAuthority}` : undefined}
          href={params.spaceRepo ? spacePath() : undefined}
          preserveLabel
        />
      </Show>

      <Show when={params.spaceRepo}>
        <BreadcrumbRow
          icon="lucide--book-user"
          label={repoHandle() ?? params.spaceRepo}
          detail={repoHandle() ? params.spaceRepo : undefined}
          detailHref={repoHandle() ? `/at://${params.spaceRepo}` : undefined}
          href={params.collection ? repoPath() : undefined}
          preserveLabel={!!repoHandle()}
        />
      </Show>

      <Show when={params.collection}>
        <BreadcrumbRow
          icon="lucide--folder-open"
          label={params.collection}
          href={params.rkey ? collectionPath() : undefined}
        />
      </Show>

      <Show when={params.rkey}>
        <BreadcrumbRow icon="lucide--file-json" label={params.rkey} />
      </Show>
    </Breadcrumbs>
  );
};
