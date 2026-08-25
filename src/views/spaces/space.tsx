import type { Nsid } from "@atcute/lexicons";
import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, type JSX, Show } from "solid-js";

import { Button } from "../../components/button.jsx";
import DidHoverCard from "../../components/hover-card/did.jsx";
import { NestedLayout } from "../../components/nested-layout.jsx";
import { resolveRawLexicon } from "../../lib/lexicon.js";
import {
  getSimpleSpace,
  listSpaceRepos,
  type SimpleSpaceInfo,
  type SpaceRepo,
} from "../../lib/spaces.js";
import {
  makeSpacePath,
  makeSpaceRef,
  makeSpaceRepoPath,
  useSpaceRecords,
  useSpacesAuth,
} from "./context.jsx";
import { SpaceRecordEditor } from "./create-record.jsx";
import { ManageSpaceDialog } from "./manage-space.jsx";
import { EmptyState, ErrorNotice, LoadingState } from "./shared.jsx";
import { SimpleSpaceDetails } from "./simple-space.jsx";
import { parseSpaceTypeInfo, SpaceTypeDetails, type SpaceTypeInfo } from "./space-type-details.jsx";

const SpaceView = () => {
  const auth = useSpacesAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const spaceRecords = useSpaceRecords();
  const hidden = () => !!params.spaceRepo;
  const [repos, setRepos] = createSignal<SpaceRepo[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [simpleSpaceInfo, setSimpleSpaceInfo] = createSignal<SimpleSpaceInfo>();
  const [simpleSpaceResolved, setSimpleSpaceResolved] = createSignal(false);
  const [spaceTypeInfo, setSpaceTypeInfo] = createSignal<SpaceTypeInfo>();
  const [spaceTypeLoading, setSpaceTypeLoading] = createSignal(false);
  const [spaceTypeError, setSpaceTypeError] = createSignal<string>();
  let activeKey = "";
  let requestVersion = 0;
  let simpleSpaceKey = "";
  let simpleSpaceVersion = 0;
  let spaceTypeKey = "";
  let spaceTypeVersion = 0;

  const space = () => makeSpaceRef(params.spaceAuthority!, params.spaceType!, params.skey!);
  const spacePath = () => makeSpacePath(params.spaceAuthority!, params.spaceType!, params.skey!);
  const showingDetails = () => location.hash === "#details";

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
  const hasOwnRepo = createMemo(() => repos().some((repo) => repo.did === auth().sub));

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
    setSimpleSpaceResolved(false);

    const version = simpleSpaceVersion;
    void getSimpleSpace(agent, spaceRef)
      .then((info) => {
        if (version === simpleSpaceVersion) {
          setSimpleSpaceInfo(info);
          setSimpleSpaceResolved(true);
        }
      })
      .catch(() => {
        if (version === simpleSpaceVersion) {
          setSimpleSpaceInfo(undefined);
          setSimpleSpaceResolved(true);
        }
      });
  });

  createEffect(() => {
    if (hidden()) return;

    const nsid = params.spaceType;
    if (!nsid || nsid === spaceTypeKey) return;

    spaceTypeKey = nsid;
    spaceTypeVersion += 1;
    setSpaceTypeInfo(undefined);
    setSpaceTypeError(undefined);
    setSpaceTypeLoading(true);

    const version = spaceTypeVersion;
    void resolveRawLexicon(nsid as Nsid).then(
      ({ rawSchema }) => {
        if (version !== spaceTypeVersion) return;

        try {
          setSpaceTypeInfo(parseSpaceTypeInfo(rawSchema));
        } catch (err) {
          setSpaceTypeError(
            err instanceof Error ? err.message : "Could not read the Space type declaration",
          );
        } finally {
          setSpaceTypeLoading(false);
        }
      },
      (err) => {
        if (version === spaceTypeVersion) {
          setSpaceTypeError(
            err instanceof Error ? err.message : "Could not resolve the Space type declaration",
          );
          setSpaceTypeLoading(false);
        }
      },
    );
  });

  return (
    <Show when={!hidden()}>
      <div class="flex w-full flex-col gap-3 py-2 pb-10">
        <div class="flex min-h-7 items-center justify-between px-2 text-sm sm:text-base">
          <div class="flex items-center gap-3 sm:gap-4">
            <Tab label="Writers" />
            <Tab details label="Details" />
          </div>
          <div class="flex items-center gap-1">
            <Show when={loaded() && !hasOwnRepo()}>
              <SpaceRecordEditor
                authority={params.spaceAuthority!}
                type={params.spaceType!}
                skey={params.skey!}
                space={space()}
                label="Create"
                onSaved={() => void loadRepos(true)}
              />
            </Show>
            <Show when={params.spaceAuthority === auth().sub && simpleSpaceInfo()}>
              {(info) => (
                <ManageSpaceDialog
                  info={info()}
                  space={space()}
                  onUpdated={(updated) => {
                    setSimpleSpaceInfo(updated);
                    void loadRepos(true);
                  }}
                  onDeleted={() => {
                    spaceRecords.invalidateRecords();
                    navigate("/spaces", { replace: true });
                  }}
                />
              )}
            </Show>
          </div>
        </div>

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

        <Show when={showingDetails()}>
          <div class="flex w-full flex-col gap-5 py-2 pb-10">
            <SpaceTypeDetails
              info={spaceTypeInfo()}
              loading={spaceTypeLoading()}
              error={spaceTypeError()}
            />

            <Show when={!simpleSpaceResolved()}>
              <LoadingState label="Loading access details…" />
            </Show>
            <Show when={simpleSpaceInfo()}>
              {(info) => (
                <SimpleSpaceDetails
                  info={info()}
                  space={space()}
                  authority={params.spaceAuthority!}
                />
              )}
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
};

export const SpaceLayout = (props: { children?: JSX.Element }) => {
  const params = useParams();
  const hasChild = () => !!params.spaceRepo;
  const key = () => `${params.spaceAuthority}/${params.spaceType}/${params.skey}`;

  return (
    <NestedLayout key={key()} hasChild={hasChild()} view={() => <SpaceView />}>
      {props.children}
    </NestedLayout>
  );
};
