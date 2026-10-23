import { A, type RouteSectionProps, useLocation, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, Show } from "solid-js";

import { Button } from "../../components/button.jsx";
import { CollectionList } from "../../components/collection-list.jsx";
import { NestedLayout } from "../../components/nested-layout.jsx";
import { EmptyState, ErrorNotice, LoadingState } from "../../components/states.jsx";
import { LoadMoreSentinel } from "../../lib/infinite-scroll.jsx";
import { listSpaceRecords, type SpaceRecord } from "../../lib/spaces.js";
import { SpaceBlobList } from "./blobs.jsx";
import {
  makeSpaceCollectionPath,
  makeSpaceRef,
  makeSpaceRepoPath,
  useSpaceRecords,
  useSpacesAuth,
} from "./context.jsx";
import { SpaceRecordEditor } from "./create-record.jsx";

const SpaceRepoView = () => {
  const auth = useSpacesAuth();
  const spaceRecords = useSpaceRecords();
  const location = useLocation();
  const params = useParams();
  const hidden = () => !!params.collection || !!params.cid;
  const selectedTab = () => (location.hash === "#blobs" ? "blobs" : "collections");
  const repo = () => params.spaceRepo!;
  const [records, setRecords] = createSignal<SpaceRecord[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let activeKey = "";
  let requestVersion = 0;

  const space = () => makeSpaceRef(params.spaceAuthority!, params.spaceType!, params.skey!);

  const collections = createMemo(() => {
    const grouped = new Map<string, number>();
    for (const record of records()) {
      grouped.set(record.collection, (grouped.get(record.collection) ?? 0) + 1);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  const loadRecords = async (reset = false, version = requestVersion) => {
    if (loading() && !reset) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await listSpaceRecords(auth(), space(), repo(), {
        cursor: reset ? undefined : cursor(),
        excludeValues: true,
        limit: 1000,
      });
      if (version !== requestVersion) return;
      setRecords((current) => (reset ? result.records : [...current, ...result.records]));
      setCursor(result.cursor);
      setLoaded(true);
    } catch (err) {
      if (version !== requestVersion) return;
      setError(err instanceof Error ? err.message : "Could not load Space collections");
      setLoaded(true);
    } finally {
      if (version === requestVersion) setLoading(false);
    }
  };

  createEffect(() => {
    const key = `${auth().sub}\n${space()}\n${repo()}\n${spaceRecords.recordsVersion()}`;
    if (key !== activeKey) {
      activeKey = key;
      requestVersion += 1;
      setRecords([]);
      setCursor(undefined);
      setLoaded(false);
      setLoading(false);
      setError(undefined);
    }
    if (!hidden() && selectedTab() === "collections" && !loaded() && !loading()) {
      void loadRecords(true, requestVersion);
    }
  });

  const SpaceRepoTab = (props: { tab: "collections" | "blobs"; label: string }) => (
    <A
      classList={{
        "border-b-2 font-medium transition-colors": true,
        "border-transparent not-hover:text-neutral-600 not-hover:dark:text-neutral-300/80":
          selectedTab() !== props.tab,
      }}
      href={`${makeSpaceRepoPath(
        params.spaceAuthority!,
        params.spaceType!,
        params.skey!,
        repo(),
      )}#${props.tab}`}
    >
      {props.label}
    </A>
  );

  return (
    <Show when={!hidden()}>
      <div class="flex w-full flex-col gap-3 py-2 pb-10">
        <div class="flex min-h-7 items-center justify-between px-2 text-sm sm:text-base">
          <div class="flex items-center gap-3 sm:gap-4">
            <SpaceRepoTab tab="collections" label="Collections" />
            <SpaceRepoTab tab="blobs" label="Blobs" />
          </div>
          <Show when={selectedTab() === "collections" && repo() === auth().sub}>
            <SpaceRecordEditor
              authority={params.spaceAuthority!}
              type={params.spaceType!}
              skey={params.skey!}
              space={space()}
              label="Create"
            />
          </Show>
        </div>

        <Show when={selectedTab() === "collections"}>
          <Show when={loading() && !loaded()}>
            <LoadingState label="Loading collections…" />
          </Show>

          <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

          <Show when={loaded() && (!error() || records().length > 0)}>
            <CollectionList
              collections={collections().map(([collection, count]) => ({
                nsid: collection,
                count: `${count.toLocaleString()}${cursor() ? "+" : ""}`,
                href: makeSpaceCollectionPath(
                  params.spaceAuthority!,
                  params.spaceType!,
                  params.skey!,
                  repo(),
                  collection,
                ),
              }))}
              fallback={<EmptyState icon="lucide--folder-open" message="No collections found" />}
            />

            <Show when={cursor()}>
              <Button
                onClick={() => void loadRecords()}
                disabled={loading()}
                classList={{ "w-fit self-center": true }}
              >
                <Show when={loading()} fallback={<span class="iconify lucide--chevrons-down" />}>
                  <span class="iconify lucide--loader-circle animate-spin" />
                </Show>
                Load more records
              </Button>
              <LoadMoreSentinel
                hasMore={() => !!cursor() && !error()}
                loading={() => loading()}
                onLoadMore={() => void loadRecords()}
              />
            </Show>
          </Show>
        </Show>

        <Show when={selectedTab() === "blobs"}>
          <SpaceBlobList
            auth={auth}
            space={space()}
            repo={repo()}
            repoPath={makeSpaceRepoPath(
              params.spaceAuthority!,
              params.spaceType!,
              params.skey!,
              repo(),
            )}
          />
        </Show>
      </div>
    </Show>
  );
};

export const SpaceRepoLayout = (props: RouteSectionProps) => {
  const params = useParams();
  const hasChild = () => !!params.collection || !!params.cid;
  const key = () =>
    `${params.spaceAuthority}/${params.spaceType}/${params.skey}/${params.spaceRepo}`;

  return (
    <NestedLayout key={key()} hasChild={hasChild()} view={() => <SpaceRepoView />}>
      {props.children}
    </NestedLayout>
  );
};
