import { A, type RouteSectionProps, useLocation, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

import { Button } from "../../components/button.jsx";
import DidHoverCard from "../../components/hover-card/did.jsx";
import { NestedLayout } from "../../components/nested-layout.jsx";
import {
  getSimpleSpace,
  listSpaceRepos,
  type SimpleSpaceInfo,
  type SpaceRepo,
} from "../../lib/spaces.js";
import { makeSpacePath, makeSpaceRef, makeSpaceRepoPath, useSpacesAuth } from "./context.jsx";
import { EmptyState, ErrorNotice, LoadingState } from "./shared.jsx";
import { SimpleSpaceDetails } from "./simple-space.jsx";

const SpaceView = () => {
  const auth = useSpacesAuth();
  const location = useLocation();
  const params = useParams();
  const hidden = () => !!params.spaceRepo;
  const [repos, setRepos] = createSignal<SpaceRepo[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [simpleSpaceInfo, setSimpleSpaceInfo] = createSignal<SimpleSpaceInfo>();
  let activeKey = "";
  let requestVersion = 0;
  let simpleSpaceKey = "";
  let simpleSpaceVersion = 0;

  const space = () => makeSpaceRef(params.spaceAuthority!, params.spaceType!, params.skey!);
  const spacePath = () => makeSpacePath(params.spaceAuthority!, params.spaceType!, params.skey!);
  const showingDetails = () => location.hash === "#details" && !!simpleSpaceInfo();

  const Tab = (props: { details?: boolean; label: string }) => {
    const active = () => (props.details ? showingDetails() : !showingDetails());
    return (
      <A
        classList={{
          "border-b-2 font-medium transition-colors": true,
          "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
            !active(),
        }}
        href={`${spacePath()}${props.details ? "#details" : ""}`}
      >
        {props.label}
      </A>
    );
  };

  const orderedRepos = createMemo(() =>
    [...repos()].sort((a, b) => {
      if (a.did === auth().sub) return -1;
      if (b.did === auth().sub) return 1;
      return a.did.localeCompare(b.did);
    }),
  );

  const loadRepos = async (reset = false, version = requestVersion) => {
    if (loading() && !reset) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await listSpaceRepos(auth(), space(), {
        cursor: reset ? undefined : cursor(),
        limit: 1000,
      });
      if (version !== requestVersion) return;
      setRepos((current) => (reset ? result.repos : [...current, ...result.repos]));
      setCursor(result.cursor);
      setLoaded(true);
    } catch (err) {
      if (version !== requestVersion) return;
      setError(err instanceof Error ? err.message : "Could not load Space writers");
      setLoaded(true);
    } finally {
      if (version === requestVersion) setLoading(false);
    }
  };

  createEffect(() => {
    const key = `${auth().sub}\n${space()}`;
    if (key !== activeKey) {
      activeKey = key;
      requestVersion += 1;
      setRepos([]);
      setCursor(undefined);
      setLoaded(false);
      setLoading(false);
      setError(undefined);
    }
    if (!hidden() && !loaded() && !loading()) void loadRepos(true, requestVersion);
  });

  createEffect(() => {
    if (hidden()) return;

    const agent = auth();
    const spaceRef = space();
    const key = `${agent.sub}\n${spaceRef}`;
    if (key === simpleSpaceKey) return;

    simpleSpaceKey = key;
    simpleSpaceVersion += 1;
    setSimpleSpaceInfo(undefined);

    const version = simpleSpaceVersion;
    void getSimpleSpace(agent, spaceRef)
      .then((info) => {
        if (version === simpleSpaceVersion) setSimpleSpaceInfo(info);
      })
      .catch(() => {
        if (version === simpleSpaceVersion) setSimpleSpaceInfo(undefined);
      });
  });

  return (
    <Show when={!hidden()}>
      <div class="flex w-full flex-col gap-3 py-2 pb-10">
        <Show when={simpleSpaceInfo()}>
          <div class="flex min-h-7 items-center gap-3 px-2 text-sm sm:gap-4 sm:text-base">
            <Tab label="Writers" />
            <Tab details label="Details" />
          </div>
        </Show>

        <Show when={!showingDetails()}>
          <Show when={loading() && !loaded()}>
            <LoadingState label="Loading writers…" />
          </Show>

          <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

          <Show when={loaded() && (!error() || repos().length > 0)}>
            <ul class="flex flex-col">
              <For each={orderedRepos()}>
                {(repo) => (
                  <li>
                    <DidHoverCard
                      did={repo.did}
                      class="flex w-full min-w-0 items-center rounded hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                      renderTrigger={({ loading: hoverLoading }) => (
                        <A
                          href={makeSpaceRepoPath(
                            params.spaceAuthority!,
                            params.spaceType!,
                            params.skey!,
                            repo.did,
                          )}
                          class="flex w-full min-w-0 items-baseline gap-2 p-2 text-left text-sm"
                          classList={{ "hover-card-trigger-loading": hoverLoading() }}
                        >
                          <span class="min-w-0 truncate font-medium text-blue-500 dark:text-blue-400">
                            {repo.did}
                          </span>
                          <Show when={repo.did === auth().sub}>
                            <span class="shrink-0 self-center rounded border border-neutral-300 px-1 py-px text-[9px] leading-none text-neutral-500 uppercase dark:border-neutral-600 dark:text-neutral-400">
                              You
                            </span>
                          </Show>
                          <span class="ml-auto min-w-0 truncate text-xs text-neutral-500 dark:text-neutral-400">
                            {repo.rev}
                          </span>
                        </A>
                      )}
                    />
                  </li>
                )}
              </For>
            </ul>

            <Show when={repos().length === 0}>
              <EmptyState icon="lucide--book-user" message="No writers found" />
            </Show>

            <Show when={cursor()}>
              <Button
                onClick={() => void loadRepos()}
                disabled={loading()}
                classList={{ "w-fit self-center": true }}
              >
                <Show when={loading()} fallback={<span class="iconify lucide--chevrons-down" />}>
                  <span class="iconify lucide--loader-circle animate-spin" />
                </Show>
                Load more writers
              </Button>
            </Show>
          </Show>
        </Show>

        <Show when={showingDetails() && simpleSpaceInfo()}>
          {(info) => (
            <SimpleSpaceDetails info={info()!} space={space()} authority={params.spaceAuthority!} />
          )}
        </Show>
      </div>
    </Show>
  );
};

export const SpaceLayout = (props: RouteSectionProps) => {
  const params = useParams();
  const hasChild = () => !!params.spaceRepo;
  const key = () => `${params.spaceAuthority}/${params.spaceType}/${params.skey}`;

  return (
    <NestedLayout key={key()} hasChild={hasChild()} view={() => <SpaceView />}>
      {props.children}
    </NestedLayout>
  );
};
