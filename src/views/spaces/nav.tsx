import { A, useParams } from "@solidjs/router";
import { createResource, createSignal, type JSX, Show } from "solid-js";

import { Favicon } from "../../components/favicon.jsx";
import { resolveDidInfo } from "../../components/hover-card/did.jsx";
import {
  makeSpaceCollectionPath,
  makeSpacePath,
  makeSpaceRepoPath,
  useSpaceRecordMetadata,
} from "./context.jsx";

const resolveDidHandle = async (did: string) => {
  try {
    return (await resolveDidInfo(did)).handle;
  } catch {
    return undefined;
  }
};

const HierarchyRow = (props: {
  icon?: string;
  leading?: JSX.Element;
  label: JSX.Element;
  detailPrefix?: JSX.Element;
  detail?: JSX.Element;
  detailHref?: string;
  href?: string;
  badge?: JSX.Element;
  preserveLabel?: boolean;
}) => {
  const [detailHovered, setDetailHovered] = createSignal(false);

  const Leading = () => (
    <Show
      when={props.leading}
      fallback={
        <span
          class={`iconify ${props.icon ?? ""} shrink-0 text-neutral-500 dark:text-neutral-400`}
        />
      }
    >
      {(leading) => leading()}
    </Show>
  );

  const Label = (labelProps: { linked: boolean }) => (
    <span
      class="min-w-0 truncate py-0.5 font-medium"
      classList={{
        "shrink-0": props.preserveLabel,
        "text-blue-500 transition-colors dark:text-blue-400": labelProps.linked,
        "group-hover/row:text-blue-600 dark:group-hover/row:text-blue-300":
          labelProps.linked && !detailHovered(),
      }}
    >
      {props.label}
    </span>
  );

  const DetailPrefix = () => (
    <Show when={props.detailPrefix}>
      <span class="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">
        {props.detailPrefix}
      </span>
    </Show>
  );

  const Content = (contentProps: { linked: boolean }) => (
    <>
      <Leading />
      <span class="flex min-w-0 flex-1 items-baseline gap-2">
        <Label linked={contentProps.linked} />
        <DetailPrefix />
        <Show when={props.detail}>
          <span class="min-w-0 truncate text-xs text-neutral-500 dark:text-neutral-400">
            {props.detail}
          </span>
        </Show>
      </span>
      <Show when={props.badge}>{props.badge}</Show>
    </>
  );

  const classes =
    "group/row flex min-h-6 w-full min-w-0 items-center gap-2 rounded-md border-[0.5px] border-transparent px-2 text-left transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 sm:min-h-7 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40";

  const SplitContent = (splitProps: { detailHref: string }) => (
    <div class={`${classes} relative`} onMouseLeave={() => setDetailHovered(false)}>
      <Show keyed when={props.href}>
        {(href) => (
          <A href={href} class="absolute inset-0 rounded-md">
            <span class="sr-only">Open {props.label}</span>
          </A>
        )}
      </Show>
      <span class="pointer-events-none relative z-10 flex shrink-0">
        <Leading />
      </span>
      <span
        class="pointer-events-none relative z-10 flex min-w-0 flex-1 items-baseline"
        classList={{ "gap-1": !!props.detailPrefix, "gap-2": !props.detailPrefix }}
      >
        <span class="flex max-w-full min-w-0 shrink-0 items-baseline gap-2">
          <Label linked={!!props.href} />
          <DetailPrefix />
        </span>
        <A
          href={splitProps.detailHref}
          class="pointer-events-auto relative z-20 min-w-0 truncate text-xs text-neutral-500 hover:text-blue-500 hover:underline dark:text-neutral-400 dark:hover:text-blue-400"
          onMouseEnter={() => setDetailHovered(true)}
          onMouseLeave={() => setDetailHovered(false)}
        >
          {props.detail}
        </A>
      </span>
      <Show when={props.badge}>{props.badge}</Show>
    </div>
  );

  return (
    <Show
      when={props.detailHref}
      fallback={
        <Show
          keyed
          when={props.href}
          fallback={
            <div class={classes}>
              <Content linked={false} />
            </div>
          }
        >
          {(href) => (
            <A href={href} class={classes}>
              <Content linked />
            </A>
          )}
        </Show>
      }
    >
      {(detailHref) => <SplitContent detailHref={detailHref()} />}
    </Show>
  );
};

export const SpacesNav = () => {
  const params = useParams();
  const recordMetadata = useSpaceRecordMetadata();
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
    <nav class="flex w-full flex-col text-sm wrap-anywhere sm:text-base">
      <HierarchyRow
        icon="lucide--lock-keyhole"
        label="Spaces"
        href={hasSpace() ? "/spaces" : undefined}
        badge={
          <span class="ml-auto shrink-0 rounded-md border border-yellow-600 px-1.5 py-0.5 text-[8px] font-medium tracking-wide text-yellow-600 uppercase sm:text-[9px] dark:border-amber-400 dark:text-amber-400">
            Alpha
          </span>
        }
      />

      <Show when={hasSpace()}>
        <HierarchyRow
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
        <HierarchyRow
          icon="lucide--book-user"
          label={repoHandle() ?? params.spaceRepo}
          detail={repoHandle() ? params.spaceRepo : undefined}
          detailHref={repoHandle() ? `/at://${params.spaceRepo}` : undefined}
          href={params.collection ? repoPath() : undefined}
          preserveLabel={!!repoHandle()}
        />
      </Show>

      <Show when={params.collection}>
        <HierarchyRow
          icon="lucide--folder-open"
          label={params.collection}
          href={params.rkey ? collectionPath() : undefined}
        />
      </Show>

      <Show when={params.rkey}>
        <HierarchyRow
          icon="lucide--file-json"
          label={params.rkey}
          detail={recordMetadata.cid()}
          preserveLabel
        />
      </Show>
    </nav>
  );
};
