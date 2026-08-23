import { For, Show } from "solid-js";

import { type SimpleSpaceInfo } from "../../lib/spaces.js";
import { SimpleSpaceMembers } from "./simple-space-members.jsx";

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
        <SimpleSpaceMembers space={props.space} authority={props.authority} />
      </Show>
    </div>
  );
};
