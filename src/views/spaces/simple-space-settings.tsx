import { isDid } from "@atcute/lexicons/syntax";
import { Show } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";

import { TextInput } from "../../components/text-input.jsx";
import type {
  NewSimpleSpaceAppAccess,
  NewSimpleSpacePolicy,
  SimpleSpaceConfiguration,
  SimpleSpaceInfo,
} from "../../lib/spaces.js";

type PolicyKind = NewSimpleSpacePolicy["kind"];
type AppAccessKind = NewSimpleSpaceAppAccess["kind"];

export interface SimpleSpaceSettingsDraft {
  policy: PolicyKind;
  managingApp: string;
  appAccess: AppAccessKind;
  allowedApps: string;
}

const selectClass =
  "dark:bg-dark-100 w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-400 dark:border-neutral-600 dark:focus:border-neutral-400";

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

export const defaultSimpleSpaceSettings = (): SimpleSpaceSettingsDraft => ({
  policy: "member-list",
  managingApp: "",
  appAccess: "open",
  allowedApps: "",
});

export const simpleSpaceSettingsFromInfo = (
  info: SimpleSpaceInfo,
): SimpleSpaceSettingsDraft | undefined => {
  if (info.policy.kind === "unknown" || info.appAccess.kind === "unknown") return;

  return {
    policy: info.policy.kind,
    managingApp: info.policy.kind === "managing-app" ? info.policy.managingApp : "",
    appAccess: info.appAccess.kind,
    allowedApps: info.appAccess.kind === "allow-list" ? info.appAccess.allowed.join("\n") : "",
  };
};

export const parseSimpleSpaceSettings = (
  draft: SimpleSpaceSettingsDraft,
): SimpleSpaceConfiguration => {
  let policy: NewSimpleSpacePolicy;
  if (draft.policy === "managing-app") {
    const managingApp = draft.managingApp.trim();
    if (!isServiceIdentifier(managingApp)) {
      throw new Error("Managing app must be a DID with an optional service fragment");
    }
    policy = { kind: "managing-app", managingApp };
  } else {
    policy = { kind: draft.policy };
  }

  let appAccess: NewSimpleSpaceAppAccess;
  if (draft.appAccess === "allow-list") {
    const allowed = parseAllowedApps(draft.allowedApps);
    if (allowed.length === 0) {
      throw new Error("Add at least one OAuth client ID to the application allow list");
    }
    appAccess = { kind: "allow-list", allowed };
  } else {
    appAccess = { kind: "open" };
  }

  return { policy, appAccess };
};

export const SimpleSpaceSettingsFields = (props: {
  settings: SimpleSpaceSettingsDraft;
  setSettings: SetStoreFunction<SimpleSpaceSettingsDraft>;
}) => (
  <>
    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">User access</span>
      <select
        class={selectClass}
        value={props.settings.policy}
        onChange={(event) => props.setSettings("policy", event.currentTarget.value as PolicyKind)}
      >
        <option value="member-list">Member list</option>
        <option value="public">Public</option>
        <option value="managing-app">Managing app</option>
      </select>
      <span class="text-xs text-neutral-500 dark:text-neutral-400">
        {props.settings.policy === "member-list"
          ? "Only members you add can access the Space."
          : props.settings.policy === "public"
            ? "Any user may access the Space."
            : "The managing application decides who may access the Space."}
      </span>
    </label>

    <Show when={props.settings.policy === "managing-app"}>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Managing app</span>
        <TextInput
          value={props.settings.managingApp}
          onInput={(event) => props.setSettings("managingApp", event.currentTarget.value)}
          placeholder="did:web:example.com#service"
          class="w-full"
          required
        />
        <span class="text-xs text-neutral-500 dark:text-neutral-400">
          A service DID that answers access checks for this Space.
        </span>
      </label>
    </Show>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">Application access</span>
      <select
        class={selectClass}
        value={props.settings.appAccess}
        onChange={(event) =>
          props.setSettings("appAccess", event.currentTarget.value as AppAccessKind)
        }
      >
        <option value="open">Open</option>
        <option value="allow-list">Allow list</option>
      </select>
      <span class="text-xs text-neutral-500 dark:text-neutral-400">
        {props.settings.appAccess === "open"
          ? "Any application used by an authorized user may access the Space."
          : "Only applications with a listed OAuth client ID may access the Space."}
      </span>
    </label>

    <Show when={props.settings.appAccess === "allow-list"}>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Allowed applications</span>
        <textarea
          value={props.settings.allowedApps}
          onInput={(event) => props.setSettings("allowedApps", event.currentTarget.value)}
          placeholder="One OAuth client ID per line"
          rows={3}
          spellcheck={false}
          class="dark:bg-dark-100 min-h-20 w-full resize-y rounded-md bg-white px-2 py-1.5 text-sm outline-1 outline-neutral-200 focus:outline-neutral-400 dark:outline-neutral-600 dark:focus:outline-neutral-400"
          required
        />
        <span class="text-xs text-neutral-500 dark:text-neutral-400">
          PDSls cannot access allow-listed Spaces.
        </span>
      </label>
    </Show>
  </>
);
