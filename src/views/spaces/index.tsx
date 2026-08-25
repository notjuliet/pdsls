import { A, type RouteSectionProps, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, type JSX, Show } from "solid-js";

import { hasUserScope, SPACE_READ_SCOPE_ID } from "../../auth/scope-utils";
import {
  agent,
  setOpenManager,
  setPendingPermissionEdit,
  setShowAddAccount,
} from "../../auth/state";
import { Button } from "../../components/button.jsx";
import { Favicon } from "../../components/favicon.jsx";
import DidHoverCard from "../../components/hover-card/did.jsx";
import { NestedLayout } from "../../components/nested-layout.jsx";
import { listSpaces, parseSpaceUri, type SpaceView } from "../../lib/spaces.js";
import {
  makeSpacePath,
  SpaceRecordsContext,
  SpacesAuthContext,
  useSpaceRecords,
  useSpacesAuth,
} from "./context.jsx";
import { CreateSpaceDialog } from "./create-space.jsx";
import { SpacesNav } from "./nav.jsx";
import { EmptyState, ErrorNotice, LoadingState } from "./shared.jsx";
import { SpaceLayout } from "./space.jsx";

const SignInPrompt = () => {
  const signIn = () => {
    setOpenManager(true);
    setShowAddAccount(true);
  };

  return (
    <div class="flex flex-col items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
      <div>
        <h2 class="font-medium">Sign in to use Spaces</h2>
        <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Spaces require OAuth permissions.
        </p>
      </div>
      <Button onClick={signIn} classList={{ "bg-blue-500! text-white! border-blue-500!": true }}>
        <span class="iconify lucide--log-in" />
        Sign in
      </Button>
    </div>
  );
};

const PermissionPrompt = () => {
  const editPermissions = () => {
    const auth = agent();
    if (!auth) return;
    setPendingPermissionEdit(auth.sub);
    setOpenManager(true);
  };

  return (
    <div class="flex flex-col items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
      <div>
        <h2 class="font-medium">Space permission required</h2>
        <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Re-authorize this account and enable “View non-public records”.
        </p>
      </div>
      <Button
        onClick={editPermissions}
        classList={{ "bg-blue-500! text-white! border-blue-500!": true }}
      >
        <span class="iconify lucide--key-round" />
        Edit permissions
      </Button>
    </div>
  );
};

const SpacesIndex = () => {
  const auth = useSpacesAuth();
  const spaceRecords = useSpaceRecords();
  const params = useParams();
  const hidden = () => !!params.spaceAuthority;
  const [spaces, setSpaces] = createSignal<SpaceView[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let activeKey = "";
  let requestVersion = 0;

  const groupedSpaces = createMemo(() => {
    const groups = new Map<string, { type: string; skey: string; authorities: Set<string> }>();

    for (const space of spaces()) {
      const parsed = parseSpaceUri(space.uri);
      if (!parsed) continue;

      const key = `${parsed.type}\n${parsed.skey}`;
      const group = groups.get(key);
      if (group) {
        group.authorities.add(parsed.authority);
      } else {
        groups.set(key, {
          type: parsed.type,
          skey: parsed.skey,
          authorities: new Set([parsed.authority]),
        });
      }
    }

    return Array.from(groups.values(), (group) => ({
      ...group,
      authorities: Array.from(group.authorities).sort((a, b) => a.localeCompare(b)),
    })).sort((a, b) => a.type.localeCompare(b.type) || a.skey.localeCompare(b.skey));
  });

  const loadSpaces = async (reset = false, version = requestVersion) => {
    if (loading() && !reset) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await listSpaces(auth(), { cursor: reset ? undefined : cursor() });
      if (version !== requestVersion) return;
      setSpaces((current) => (reset ? result.spaces : [...current, ...result.spaces]));
      setCursor(result.cursor);
      setLoaded(true);
    } catch (err) {
      if (version !== requestVersion) return;
      setError(err instanceof Error ? err.message : "Could not load Spaces");
      setLoaded(true);
    } finally {
      if (version === requestVersion) setLoading(false);
    }
  };

  createEffect(() => {
    const key = `${auth().sub}\n${auth().session.token.scope}\n${spaceRecords.recordsVersion()}`;
    if (key !== activeKey) {
      activeKey = key;
      requestVersion += 1;
      setSpaces([]);
      setCursor(undefined);
      setLoaded(false);
      setError(undefined);
      setLoading(false);
    }
    if (!hidden() && !loaded() && !loading()) void loadSpaces(true, requestVersion);
  });

  return (
    <Show when={!hidden()}>
      <div class="flex w-full flex-col gap-3 px-2 py-2 pb-10">
        <Show when={error()}>
          {(message) => (
            <div class="flex flex-col gap-2">
              <ErrorNotice message={message()} />
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                The account’s PDS may not be running the Spaces alpha yet.
              </p>
            </div>
          )}
        </Show>

        <Show when={loading() && spaces().length === 0}>
          <LoadingState label="Loading Spaces…" />
        </Show>

        <Show when={loaded() && !error() && spaces().length === 0}>
          <EmptyState
            icon="lucide--package-open"
            message="No Spaces with records were found for this account."
          />
        </Show>

        <ul class="-mx-2 flex flex-col gap-2">
          <For each={groupedSpaces()}>
            {(group) => (
              <li>
                <div class="flex min-w-0 items-center gap-2 px-2 py-1 text-sm">
                  <Favicon domain={group.type.split(".").slice(0, 2).join(".")} reverse />
                  <span class="min-w-0 truncate font-medium">{group.type}</span>
                  <span class="iconify lucide--chevron-right shrink-0 text-xs text-neutral-500" />
                  <span class="shrink-0 font-medium">{group.skey}</span>
                </div>
                <ul class="flex flex-col pl-6">
                  <For each={group.authorities}>
                    {(authority) => (
                      <li>
                        <DidHoverCard
                          did={authority}
                          class="flex w-full min-w-0 items-center rounded hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                          renderTrigger={({ loading: hoverLoading }) => (
                            <A
                              href={makeSpacePath(authority, group.type, group.skey)}
                              class="flex w-full min-w-0 items-center gap-2 p-2 text-left text-sm"
                              classList={{ "hover-card-trigger-loading": hoverLoading() }}
                            >
                              <span class="min-w-0 truncate font-medium text-blue-500 dark:text-blue-400">
                                {authority}
                              </span>
                              <Show when={authority === auth().sub}>
                                <span class="shrink-0 rounded border border-neutral-300 px-1 py-px text-[9px] leading-none text-neutral-500 uppercase dark:border-neutral-600 dark:text-neutral-400">
                                  You
                                </span>
                              </Show>
                            </A>
                          )}
                        />
                      </li>
                    )}
                  </For>
                </ul>
              </li>
            )}
          </For>
        </ul>

        <Show when={cursor()}>
          <Button
            onClick={() => void loadSpaces()}
            disabled={loading()}
            classList={{ "w-fit self-center": true }}
          >
            <Show when={loading()} fallback={<span class="iconify lucide--chevrons-down" />}>
              <span class="iconify lucide--loader-circle animate-spin" />
            </Show>
            Load more Spaces
          </Button>
        </Show>
      </div>
    </Show>
  );
};

const SpacesShell = (props: { children?: JSX.Element }) => {
  const navigate = useNavigate();
  const params = useParams();
  const hasChild = () => !!params.spaceAuthority;
  const [recordsVersion, setRecordsVersion] = createSignal(0);

  const handleCreated = (result: { uri: string }) => {
    const parsed = parseSpaceUri(result.uri);
    if (!parsed) return;
    setRecordsVersion((version) => version + 1);
    navigate(makeSpacePath(parsed.authority, parsed.type, parsed.skey));
  };

  createEffect(() => {
    if (params.rkey) {
      document.title = `${params.rkey} - ${params.collection} - Spaces - PDSls`;
    } else if (params.collection) {
      document.title = `${params.collection} - Spaces - PDSls`;
    } else if (params.spaceRepo) {
      document.title = `${params.spaceRepo} - ${params.spaceType} - Spaces - PDSls`;
    } else if (params.spaceType) {
      document.title = `${params.spaceType} - Spaces - PDSls`;
    } else {
      document.title = "Spaces - PDSls";
    }
  });

  return (
    <SpaceRecordsContext.Provider
      value={{
        recordsVersion,
        invalidateRecords: () => setRecordsVersion((version) => version + 1),
      }}
    >
      <div class="flex w-full flex-col gap-1">
        <SpacesNav
          action={
            <Show when={!hasChild() && hasUserScope(SPACE_READ_SCOPE_ID)}>
              <Show when={agent()}>
                {(auth) => (
                  <SpacesAuthContext.Provider value={auth}>
                    <CreateSpaceDialog onCreated={handleCreated} />
                  </SpacesAuthContext.Provider>
                )}
              </Show>
            </Show>
          }
        />
        <div>
          <Show when={agent()} fallback={<SignInPrompt />}>
            {(auth) => (
              <Show when={hasUserScope(SPACE_READ_SCOPE_ID)} fallback={<PermissionPrompt />}>
                <SpacesAuthContext.Provider value={auth}>
                  <NestedLayout key={auth().sub} hasChild={hasChild()} view={() => <SpacesIndex />}>
                    {props.children}
                  </NestedLayout>
                </SpacesAuthContext.Provider>
              </Show>
            )}
          </Show>
        </div>
      </div>
    </SpaceRecordsContext.Provider>
  );
};

export const SpacesLayout = (props: RouteSectionProps) => (
  <SpacesShell>{props.children}</SpacesShell>
);

export const SpaceRouteLayout = (props: RouteSectionProps) => (
  <SpacesShell>
    <SpaceLayout>{props.children}</SpaceLayout>
  </SpacesShell>
);

export const LegacySpaceRedirect = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  createEffect(() => {
    if (!params.spaceAuthority || !params.spaceType || !params.skey) return;

    const rest = params.spaceRest ? `/${params.spaceRest}` : "";
    navigate(
      `${makeSpacePath(params.spaceAuthority, params.spaceType, params.skey)}${rest}${location.search}${location.hash}`,
      { replace: true },
    );
  });

  return null;
};

export { SpaceCollectionLayout } from "./collection.jsx";
export { SpaceBlobView } from "./blob.jsx";
export { SpaceRecordView } from "./record.jsx";
export { SpaceRepoLayout } from "./repo.jsx";
export { SpaceLayout } from "./space.jsx";
