import { Did } from "@atcute/lexicons";
import { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";

type Account = {
  signedIn: boolean;
  handle?: string;
  grantedScopes?: string;
};

export type Sessions = Record<string, Account>;

export const [agent, setAgent] = createSignal<OAuthUserAgent | undefined>();
export const [sessions, setSessions] = createStore<Sessions>();
export const [avatars, setAvatars] = createStore<Record<Did, string>>();
export const [openManager, setOpenManager] = createSignal(false);
export const [showAddAccount, setShowAddAccount] = createSignal(false);
export const [pendingPermissionEdit, setPendingPermissionEdit] = createSignal<string | null>(null);
