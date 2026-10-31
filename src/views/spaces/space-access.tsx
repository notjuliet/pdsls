import { For, Match, Show, Switch } from "solid-js";

import { InfoRow, InfoSection, MUTED_CLASS } from "../../components/ui/info.jsx";
import { type SpaceInfo, type SpacePolicy } from "../../lib/spaces.js";
import { SpaceMembers } from "./space-members.jsx";

/** Who a member space lets in for reading or writing. */
const accessLabel = (isPublic: boolean) => (isPublic ? "Anyone" : "Members");

/** Which of a space's settings its owner publishes for readers to see. */
const publishedLabel = (policy: boolean, members?: boolean) => {
  const published = [policy && "Settings", members && "Member list"].filter(Boolean);
  return published.length ? published.join(", ") : "Nothing";
};

export const SpaceAccessDetails = (props: {
  info: SpaceInfo;
  space: string;
  authority: string;
}) => {
  // The policy as its own kind, or nothing, so each branch below gets typed fields.
  const asKind = <K extends SpacePolicy["kind"]>(kind: K) => {
    const policy = props.info.policy;
    return policy.kind === kind ? (policy as Extract<SpacePolicy, { kind: K }>) : undefined;
  };

  return (
    <>
      <InfoSection title="Access">
        <div class="flex flex-col gap-1">
          <Switch>
            <Match when={props.info.policy.kind === "personal"}>
              <InfoRow label="Policy">
                <span class="flex flex-col">
                  <span>Personal</span>
                  <span class={MUTED_CLASS}>Only the owner can read and write</span>
                </span>
              </InfoRow>
            </Match>

            <Match when={asKind("member")}>
              {(policy) => (
                <>
                  <InfoRow label="Policy">Members</InfoRow>
                  <InfoRow label="Read">{accessLabel(policy().publicRead)}</InfoRow>
                  <InfoRow label="Write">{accessLabel(policy().publicWrite)}</InfoRow>
                  <InfoRow label="Apps">
                    <span class="flex flex-col">
                      <span>{policy().allowedApps ? "Allowed apps only" : "Any app"}</span>
                      <For each={policy().allowedApps ?? []}>
                        {(clientId) => <span class={MUTED_CLASS}>{clientId}</span>}
                      </For>
                    </span>
                  </InfoRow>
                  <InfoRow label="Published">
                    {publishedLabel(policy().publishPolicy, policy().publishMembers)}
                  </InfoRow>
                </>
              )}
            </Match>

            <Match when={asKind("managed")}>
              {(policy) => (
                <>
                  <InfoRow label="Policy">
                    <span class="flex flex-col">
                      <span>Managed by an app</span>
                      <span class={MUTED_CLASS}>{policy().managingApp}</span>
                    </span>
                  </InfoRow>
                  <InfoRow label="Published">{publishedLabel(policy().publishPolicy)}</InfoRow>
                </>
              )}
            </Match>

            <Match when={asKind("unknown")}>
              {(policy) => (
                <InfoRow label="Policy">
                  <span class="flex flex-col">
                    <span>Unknown policy</span>
                    <span class={MUTED_CLASS}>{policy().type}</span>
                  </span>
                </InfoRow>
              )}
            </Match>
          </Switch>
        </div>
      </InfoSection>

      {/* The member list matters only where it's not public on both sides. */}
      <Show when={asKind("member")}>
        {(policy) => (
          <Show when={!policy().publicRead || !policy().publicWrite}>
            <SpaceMembers
              space={props.space}
              authority={props.authority}
              readUsesMembers={!policy().publicRead}
              writeUsesMembers={!policy().publicWrite}
            />
          </Show>
        )}
      </Show>
    </>
  );
};
