import { For, Show } from "solid-js";

import { InfoRow, InfoSection, MUTED_CLASS } from "../../components/ui/info.jsx";
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
      <InfoSection title="Access">
        <div class="flex flex-col gap-1">
          <For each={["readPolicy", "writePolicy"] as const}>
            {(key) => (
              <InfoRow label={key === "readPolicy" ? "Read" : "Write"}>
                <span class="flex flex-col">
                  <span>{policyLabel(props.info[key])}</span>
                  {/* The app that decides access, under the policy that names it. */}
                  <Show when={managingApp(props.info[key])}>
                    {(app) => <span class={MUTED_CLASS}>{app()}</span>}
                  </Show>
                </span>
              </InfoRow>
            )}
          </For>
          <InfoRow label="Apps">
            <span class="flex flex-col">
              <span>{appAccessLabel(props.info)}</span>
              <For
                each={
                  props.info.appAccess.kind === "allow-list" ? props.info.appAccess.allowed : []
                }
              >
                {(clientId) => <span class={MUTED_CLASS}>{clientId}</span>}
              </For>
            </span>
          </InfoRow>
        </div>
      </InfoSection>

      <Show
        when={
          props.info.readPolicy.kind === "member-list" ||
          props.info.writePolicy.kind === "member-list"
        }
      >
        <SimpleSpaceMembers
          space={props.space}
          authority={props.authority}
          readUsesMembers={props.info.readPolicy.kind === "member-list"}
          writeUsesMembers={props.info.writePolicy.kind === "member-list"}
        />
      </Show>
    </>
  );
};
