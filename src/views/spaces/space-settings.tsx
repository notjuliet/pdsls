import { isDid } from "@atcute/lexicons/syntax";
import { For, type JSX, Show } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";

import { TextInput } from "../../components/ui/text-input.jsx";
import type { NewSpacePolicy, SpaceInfo } from "../../lib/spaces.js";

type PolicyKind = NewSpacePolicy["kind"];
type AppAccessKind = "open" | "allow-list";

/** Every policy's fields at once, so switching kinds in the form keeps what was typed. */
interface SpaceSettingsDraft {
  kind: PolicyKind;
  publicRead: boolean;
  publicWrite: boolean;
  appAccess: AppAccessKind;
  allowedApps: string;
  managingApp: string;
  publishPolicy: boolean;
  publishMembers: boolean;
}

const hintClass = "text-xs text-neutral-500 dark:text-neutral-400";

/**
 * One setting: its name on the left, its choice on the right, like the Details tab's rows. On
 * phones the name sits above, so the choices get the full width.
 */
const Row = (props: { label: string; children: JSX.Element }) => (
  <div class="grid items-start gap-1 text-sm sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-x-3">
    <span class="text-neutral-500 sm:pt-1 dark:text-neutral-400">{props.label}</span>
    <div class="flex min-w-0 flex-col gap-1">{props.children}</div>
  </div>
);

/** A small set of buttons where one is picked, so every option shows at once. */
const Segmented = <T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) => (
  <div
    role="radiogroup"
    aria-label={props.label}
    class="flex w-fit max-w-full flex-wrap gap-0.5 rounded-md bg-neutral-200/60 p-0.5 dark:bg-neutral-800"
  >
    <For each={props.options}>
      {(option) => (
        <button
          type="button"
          role="radio"
          aria-checked={props.value === option.value}
          onClick={() => props.onChange(option.value)}
          class="rounded border px-2 py-0.5 text-sm transition-colors"
          classList={{
            "dark:bg-dark-200 border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:text-neutral-100":
              props.value === option.value,
            "border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100":
              props.value !== option.value,
          }}
        >
          {option.label}
        </button>
      )}
    </For>
  </div>
);

const Checkbox = (props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) => (
  <label class="flex items-center gap-1.5">
    <input
      type="checkbox"
      checked={props.checked}
      onChange={(event) => props.onChange(event.currentTarget.checked)}
      class="h-3.5 w-3.5 accent-blue-500"
    />
    {props.label}
  </label>
);

const isServiceIdentifier = (value: string) => {
  const fragmentStart = value.indexOf("#");
  if (fragmentStart === -1) return isDid(value);
  return (
    isDid(value.slice(0, fragmentStart)) &&
    fragmentStart < value.length - 1 &&
    !value.slice(fragmentStart + 1).includes("#")
  );
};

const parseAllowedApps = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

export const defaultSpaceSettings = (): SpaceSettingsDraft => ({
  kind: "member",
  publicRead: false,
  publicWrite: false,
  appAccess: "open",
  allowedApps: "",
  managingApp: "",
  publishPolicy: false,
  publishMembers: false,
});

/** The form's starting values for a space's current policy, or nothing if PDSls can't edit it. */
export const spaceSettingsFromInfo = (info: SpaceInfo): SpaceSettingsDraft | undefined => {
  const policy = info.policy;
  switch (policy.kind) {
    case "unknown":
      return;
    case "personal":
      return { ...defaultSpaceSettings(), kind: "personal" };
    case "member":
      return {
        ...defaultSpaceSettings(),
        publicRead: policy.publicRead,
        publicWrite: policy.publicWrite,
        appAccess: policy.allowedApps ? "allow-list" : "open",
        allowedApps: policy.allowedApps?.join("\n") ?? "",
        publishPolicy: policy.publishPolicy,
        publishMembers: policy.publishMembers,
      };
    case "managed":
      return {
        ...defaultSpaceSettings(),
        kind: "managed",
        managingApp: policy.managingApp,
        publishPolicy: policy.publishPolicy,
      };
  }
};

export const parseSpaceSettings = (draft: SpaceSettingsDraft): NewSpacePolicy => {
  switch (draft.kind) {
    case "personal":
      return { kind: "personal" };
    case "member": {
      let allowedApps: string[] | undefined;
      if (draft.appAccess === "allow-list") {
        allowedApps = parseAllowedApps(draft.allowedApps);
        if (allowedApps.length === 0) {
          throw new Error("Add at least one OAuth client ID to the app allow list");
        }
      }
      return {
        kind: "member",
        publicRead: draft.publicRead,
        publicWrite: draft.publicWrite,
        allowedApps,
        publishPolicy: draft.publishPolicy,
        publishMembers: draft.publishMembers,
      };
    }
    case "managed": {
      const managingApp = draft.managingApp.trim();
      if (!isServiceIdentifier(managingApp)) {
        throw new Error("The managing app must be a DID with an optional service fragment");
      }
      return { kind: "managed", managingApp, publishPolicy: draft.publishPolicy };
    }
  }
};

const POLICY_HINTS: Record<PolicyKind, string> = {
  member: "Members you add can read and write.",
  personal: "Only you can read and write.",
  managed: "An app decides who can read and write.",
};

/** Who may read or write in a member space. */
const AUDIENCE = [
  { value: "members", label: "Members" },
  { value: "anyone", label: "Anyone" },
] as const;

export const SpaceSettingsFields = (props: {
  settings: SpaceSettingsDraft;
  setSettings: SetStoreFunction<SpaceSettingsDraft>;
}) => (
  <div class="flex flex-col gap-3">
    <Row label="Policy">
      <Segmented
        label="Policy"
        value={props.settings.kind}
        options={[
          { value: "member", label: "Members" },
          { value: "personal", label: "Personal" },
          { value: "managed", label: "Managed" },
        ]}
        onChange={(kind) => props.setSettings("kind", kind)}
      />
      <span class={hintClass}>{POLICY_HINTS[props.settings.kind]}</span>
    </Row>

    <Show when={props.settings.kind === "member"}>
      <Row label="Read">
        <Segmented
          label="Who can read"
          value={props.settings.publicRead ? "anyone" : "members"}
          options={[...AUDIENCE]}
          onChange={(value) => props.setSettings("publicRead", value === "anyone")}
        />
      </Row>
      <Row label="Write">
        <Segmented
          label="Who can write"
          value={props.settings.publicWrite ? "anyone" : "members"}
          options={[...AUDIENCE]}
          onChange={(value) => props.setSettings("publicWrite", value === "anyone")}
        />
      </Row>
      <Row label="Apps">
        <Segmented
          label="Apps that can read"
          value={props.settings.appAccess}
          options={[
            { value: "open", label: "Any" },
            { value: "allow-list", label: "Allowed only" },
          ]}
          onChange={(value) => props.setSettings("appAccess", value)}
        />
        <Show when={props.settings.appAccess === "allow-list"}>
          <textarea
            aria-label="Allowed apps"
            value={props.settings.allowedApps}
            onInput={(event) => props.setSettings("allowedApps", event.currentTarget.value)}
            placeholder="One OAuth client ID per line"
            rows={3}
            spellcheck={false}
            class="dark:bg-dark-100 min-h-20 w-full resize-y rounded-md bg-white px-2 py-1.5 text-sm outline-1 outline-neutral-200 focus:outline-neutral-400 dark:outline-neutral-600 dark:focus:outline-neutral-400"
            required
          />
        </Show>
        <span class={hintClass}>
          {props.settings.appAccess === "open"
            ? "Limits reading only."
            : "Limits reading only. PDSls can't read a Space that limits apps."}
        </span>
      </Row>
    </Show>

    <Show when={props.settings.kind === "managed"}>
      <Row label="App">
        <TextInput
          aria-label="Managing app"
          value={props.settings.managingApp}
          onInput={(event) => props.setSettings("managingApp", event.currentTarget.value)}
          placeholder="did:web:example.com#service"
          class="w-full"
          required
        />
        <span class={hintClass}>The service DID that answers access checks.</span>
      </Row>
    </Show>

    {/* Publishing writes the settings into your own repo in the Space, where readers can see
        them; otherwise only the owner can look them up. */}
    <Show when={props.settings.kind !== "personal"}>
      <Row label="Publish">
        <div class="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          <Checkbox
            checked={props.settings.publishPolicy}
            onChange={(checked) => props.setSettings("publishPolicy", checked)}
            label="Settings"
          />
          <Show when={props.settings.kind === "member"}>
            <Checkbox
              checked={props.settings.publishMembers}
              onChange={(checked) => props.setSettings("publishMembers", checked)}
              label="Member list"
            />
          </Show>
        </div>
        <span class={hintClass}>Lets anyone who can read the Space see them.</span>
      </Row>
    </Show>
  </div>
);
