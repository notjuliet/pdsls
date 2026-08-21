import { A, type RouteSectionProps, useParams } from "@solidjs/router";
import { createEffect, createSignal, For, Show } from "solid-js";

import { hasUserScope, SPACE_READ_SCOPE_ID } from "../../auth/scope-utils";
import {
  agent,
  setOpenManager,
  setPendingPermissionEdit,
  setShowAddAccount,
} from "../../auth/state";
import { Button } from "../../components/button.jsx";
import { Favicon } from "../../components/favicon.jsx";
import { NestedLayout } from "../../components/nested-layout.jsx";
import { listSpaces, parseSpaceUri, type SpaceView } from "../../lib/spaces.js";
import {
  makeSpacePath,
  SpaceRecordMetadataContext,
  SpacesAuthContext,
  useSpacesAuth,
} from "./context.jsx";
import { SpacesNav } from "./nav.jsx";
import { EmptyState, ErrorNotice, LoadingState } from "./shared.jsx";

const SignInPrompt = () => {
  const signIn = () => {
    setOpenManager(true);
    setShowAddAccount(true);
  };

  return (
    <div class="flex flex-col items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
      <div>
        <h2 class="font-medium">Sign in to preview Spaces</h2>
        <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Spaces data is non-public and must be requested from your PDS with OAuth.
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
          Re-authorize this account and enable “Read your Space records (alpha)”. It is opt-in and
          read-only.
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
  const params = useParams();
  const hidden = () => !!params.spaceAuthority;
  const [spaces, setSpaces] = createSignal<SpaceView[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let activeKey = "";
  let requestVersion = 0;

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
    const key = `${auth().sub}\n${auth().session.token.scope}`;
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
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          Preview non-public records stored in your signed-in account’s PDS.
        </p>

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

        <ul class="-mx-2 flex flex-col">
          <For each={spaces()}>
            {(space) => {
              const parsed = () => parseSpaceUri(space.uri);
              return (
                <Show when={parsed()}>
                  {(details) => (
                    <li>
                      <A
                        href={makeSpacePath(details().authority, details().type, details().skey)}
                        class="flex w-full min-w-0 items-center gap-2 rounded p-2 text-left hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                      >
                        <Favicon domain={details().type.split(".").slice(0, 2).join(".")} reverse />
                        <span class="shrink-0 font-medium text-blue-500 dark:text-blue-400">
                          {details().type}
                        </span>
                        <span class="iconify lucide--chevron-right shrink-0 text-xs text-neutral-500" />
                        <span class="shrink-0 font-medium text-blue-500 dark:text-blue-400">
                          {details().skey}
                        </span>
                        <span class="ml-auto min-w-0 truncate font-mono text-xs text-neutral-500 dark:text-neutral-400">
                          {details().authority}
                        </span>
                      </A>
                    </li>
                  )}
                </Show>
              );
            }}
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

export const SpacesLayout = (props: RouteSectionProps) => {
  const params = useParams();
  const hasChild = () => !!params.spaceAuthority;
  const [recordCid, setRecordCid] = createSignal<string>();

  createEffect(() => {
    if (params.rkey) {
      document.title = `${params.rkey} - ${params.collection} - Spaces - PDSls`;
    } else if (params.collection) {
      document.title = `${params.collection} - Spaces - PDSls`;
    } else if (params.spaceType) {
      document.title = `${params.spaceType} - Spaces - PDSls`;
    } else {
      document.title = "Spaces - PDSls";
    }
  });

  return (
    <SpaceRecordMetadataContext.Provider value={{ cid: recordCid, setCid: setRecordCid }}>
      <div class="flex w-full flex-col gap-1">
        <SpacesNav />
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
    </SpaceRecordMetadataContext.Provider>
  );
};

export { SpaceCollectionLayout } from "./collection.jsx";
export { SpaceRecordView } from "./record.jsx";
export { SpaceLayout } from "./space.jsx";
