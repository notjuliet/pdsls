import { A, useParams } from "@solidjs/router";
import { type JSX, Show } from "solid-js";

import { Favicon } from "../../components/favicon.jsx";
import { makeSpaceCollectionPath, makeSpacePath, useSpaceRecordMetadata } from "./context.jsx";

const HierarchyRow = (props: {
  icon?: string;
  leading?: JSX.Element;
  label: JSX.Element;
  detail?: JSX.Element;
  href?: string;
  badge?: JSX.Element;
  preserveLabel?: boolean;
}) => {
  const Content = (contentProps: { linked: boolean }) => (
    <>
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
      <span class="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          class="min-w-0 truncate py-0.5 font-medium"
          classList={{
            "shrink-0": props.preserveLabel,
            "text-blue-500 transition-colors hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300":
              contentProps.linked,
          }}
        >
          {props.label}
        </span>
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
    "group flex min-h-6 w-full min-w-0 items-center gap-2 rounded-md border-[0.5px] border-transparent px-2 text-left transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50/40 sm:min-h-7 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/40";

  return (
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
  );
};

export const SpacesNav = () => {
  const params = useParams();
  const recordMetadata = useSpaceRecordMetadata();
  const hasSpace = () => !!params.spaceAuthority && !!params.spaceType && !!params.skey;
  const spacePath = () =>
    hasSpace() ? makeSpacePath(params.spaceAuthority!, params.spaceType!, params.skey!) : undefined;
  const collectionPath = () =>
    spacePath() && params.collection
      ? makeSpaceCollectionPath(
          params.spaceAuthority!,
          params.spaceType!,
          params.skey!,
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
          detail={`${params.skey} · ${params.spaceAuthority}`}
          href={params.collection ? spacePath() : undefined}
          preserveLabel
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
