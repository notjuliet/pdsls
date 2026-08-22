import { A } from "@solidjs/router";
import { createEffect, createSignal, For, Show } from "solid-js";

import { Button } from "../../components/button.jsx";
import DidHoverCard from "../../components/hover-card/did.jsx";
import {
  listSimpleSpaceMembers,
  type SimpleSpaceInfo,
  type SimpleSpaceMember,
} from "../../lib/spaces.js";
import { useSpacesAuth } from "./context.jsx";
import { ErrorNotice, LoadingState } from "./shared.jsx";

const policyLabel = (info: SimpleSpaceInfo) => {
  switch (info.policy.kind) {
    case "public":
      return "Public";
    case "member-list":
      return "Member list";
    case "managing-app":
      return "Managing app";
    case "unknown":
      return "Unknown policy";
  }
};

const appAccessLabel = (info: SimpleSpaceInfo) => {
  switch (info.appAccess.kind) {
    case "open":
      return "Open";
    case "allow-list":
      return "Allow list";
    case "unknown":
      return "Unknown policy";
  }
};

export const SimpleSpaceDetails = (props: {
  info: SimpleSpaceInfo;
  space: string;
  authority: string;
}) => {
  const auth = useSpacesAuth();
  const [members, setMembers] = createSignal<SimpleSpaceMember[]>([]);
  const [cursor, setCursor] = createSignal<string>();
  const [loaded, setLoaded] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  let activeKey = "";
  let requestVersion = 0;

  const canListMembers = () =>
    props.info.policy.kind === "member-list" && props.authority === auth().sub;

  const loadMembers = async (reset = false, version = requestVersion) => {
    if (loading() && !reset) return;

    setLoading(true);
    setError(undefined);
    try {
      const result = await listSimpleSpaceMembers(auth(), props.space, {
        cursor: reset ? undefined : cursor(),
      });
      if (version !== requestVersion) return;
      setMembers((current) => {
        const next = reset ? result.members : [...current, ...result.members];
        return Array.from(new Map(next.map((member) => [member.did, member])).values());
      });
      setCursor(result.cursor);
      setLoaded(true);
    } catch (err) {
      if (version !== requestVersion) return;
      setError(err instanceof Error ? err.message : "Could not load SimpleSpace members");
      setLoaded(true);
    } finally {
      if (version === requestVersion) setLoading(false);
    }
  };

  createEffect(() => {
    const key = `${auth().sub}\n${props.space}`;
    if (key !== activeKey) {
      activeKey = key;
      requestVersion += 1;
      setMembers([]);
      setCursor(undefined);
      setLoaded(false);
      setLoading(false);
      setError(undefined);
    }
    if (canListMembers() && !loaded() && !loading()) void loadMembers(true, requestVersion);
  });

  return (
    <div class="flex w-full flex-col gap-5 py-2 pb-10">
      <dl class="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 px-2 text-sm">
        <dt class="text-neutral-500 dark:text-neutral-400">User access</dt>
        <dd>{policyLabel(props.info)}</dd>

        <Show when={props.info.policy.kind === "managing-app"}>
          <dt class="text-neutral-500 dark:text-neutral-400">Managing app</dt>
          <dd class="min-w-0 wrap-anywhere">
            {props.info.policy.kind === "managing-app" && props.info.policy.managingApp}
          </dd>
        </Show>

        <dt class="text-neutral-500 dark:text-neutral-400">Application access</dt>
        <dd>{appAccessLabel(props.info)}</dd>

        <Show when={props.info.appAccess.kind === "allow-list"}>
          <dt class="text-neutral-500 dark:text-neutral-400">Allowed applications</dt>
          <dd class="min-w-0">
            <ul class="flex flex-col gap-1 wrap-anywhere">
              <For
                each={
                  props.info.appAccess.kind === "allow-list" ? props.info.appAccess.allowed : []
                }
              >
                {(clientId) => <li>{clientId}</li>}
              </For>
            </ul>
          </dd>
        </Show>
      </dl>

      <Show when={props.info.policy.kind === "member-list"}>
        <section class="flex flex-col gap-2">
          <div class="flex items-baseline gap-2 px-2 text-sm">
            <h2 class="font-medium">Members</h2>
            <Show when={canListMembers() && loaded()}>
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                {members().length.toLocaleString()} {cursor() ? "loaded" : ""}
              </span>
            </Show>
          </div>

          <Show
            when={canListMembers()}
            fallback={
              <p class="px-2 text-xs text-neutral-500 dark:text-neutral-400">
                The member list is only available to the Space authority.
              </p>
            }
          >
            <Show when={loading() && !loaded()}>
              <LoadingState label="Loading members…" />
            </Show>

            <Show when={error()}>{(message) => <ErrorNotice message={message()} />}</Show>

            <Show when={loaded()}>
              <ul class="flex flex-col">
                <For each={members()}>
                  {(member) => (
                    <li>
                      <DidHoverCard
                        did={member.did}
                        class="flex w-full min-w-0 items-center rounded hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                        renderTrigger={({ loading: hoverLoading }) => (
                          <A
                            href={`/at://${member.did}`}
                            class="flex w-full min-w-0 items-center p-2 text-left text-sm"
                            classList={{ "hover-card-trigger-loading": hoverLoading() }}
                          >
                            <span class="min-w-0 truncate font-medium text-blue-500 dark:text-blue-400">
                              {member.did}
                            </span>
                          </A>
                        )}
                      />
                    </li>
                  )}
                </For>
              </ul>

              <Show when={members().length === 0 && !error()}>
                <p class="px-2 text-xs text-neutral-500 dark:text-neutral-400">
                  No additional members.
                </p>
              </Show>

              <Show when={cursor()}>
                <Button
                  onClick={() => void loadMembers()}
                  disabled={loading()}
                  classList={{ "w-fit self-center": true }}
                >
                  <Show when={loading()} fallback={<span class="iconify lucide--chevrons-down" />}>
                    <span class="iconify lucide--loader-circle animate-spin" />
                  </Show>
                  Load more members
                </Button>
              </Show>
            </Show>
          </Show>
        </section>
      </Show>
    </div>
  );
};
