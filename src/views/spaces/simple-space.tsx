import { For, Show } from "solid-js";

import { type SimpleSpaceInfo, type SimpleSpacePolicy } from "../../lib/spaces.js";
import { SimpleSpaceMembers } from "./simple-space-members.jsx";

const policyLabel = (policy: SimpleSpacePolicy) => {
  switch (policy.kind) {
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

const managingApp = (policy: SimpleSpacePolicy) =>
  policy.kind === "managing-app" ? policy.managingApp : undefined;

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
    <>
      <section class="flex flex-col gap-2 px-2">
        <h2 class="font-medium">Access</h2>
        <dl class="grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-sm">
          <For each={["readPolicy", "writePolicy"] as const}>
            {(key) => (
              <>
                <dt class="text-neutral-500 dark:text-neutral-400">
                  {key === "readPolicy" ? "Read access" : "Write access"}
                </dt>
                <dd>{policyLabel(props.info[key])}</dd>
                <Show when={managingApp(props.info[key])}>
                  {(app) => (
                    <>
                      <dt class="text-neutral-500 dark:text-neutral-400">
                        {key === "readPolicy" ? "Read managing app" : "Write managing app"}
                      </dt>
                      <dd class="min-w-0 wrap-anywhere">{app()}</dd>
                    </>
                  )}
                </Show>
              </>
            )}
          </For>

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
      </section>

      <Show
        when={
          props.info.readPolicy.kind === "member-list" ||
          props.info.writePolicy.kind === "member-list"
        }
      >
        <SimpleSpaceMembers space={props.space} authority={props.authority} />
      </Show>
    </>
  );
};
