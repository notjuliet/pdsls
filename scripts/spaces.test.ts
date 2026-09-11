import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { OAuthUserAgent } from "@atcute/oauth-browser-client";

mock.module("../src/lib/api", () => ({ getPDS: mock(), resolveDidDoc: mock() }));

const {
  createSimpleSpace,
  updateSimpleSpace,
  getSimpleSpace,
  putSimpleSpaceMember,
  listSimpleSpaceMembers,
} = await import("../src/lib/spaces");
const { defaultSimpleSpaceSettings, parseSimpleSpaceSettings, simpleSpaceSettingsFromInfo } =
  await import("../src/views/spaces/simple-space-settings");

const did = "did:plc:abcdefghijklmnopqrstuvwx";
const space = `at://${did}/space/app.example.group/test`;
const requests: { path: string; body?: Record<string, unknown> }[] = [];
let response: unknown;
const auth = {
  sub: did,
  handle: async (path: string, init?: RequestInit) => {
    requests.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(response);
  },
} as unknown as OAuthUserAgent;

beforeEach(() => {
  requests.length = 0;
  response = {};
});

describe("September 2026 SimpleSpace API contract", () => {
  test("create and update send independent policies, never the retired policy field", async () => {
    const config = {
      readPolicy: { kind: "member-list" as const },
      writePolicy: { kind: "public" as const },
      appAccess: { kind: "open" as const },
    };
    response = { uri: space };
    await createSimpleSpace(auth, { type: "app.example.group", skey: "test", ...config });
    await updateSimpleSpace(auth, space, config);
    expect(requests.map((request) => request.path)).toEqual([
      "/xrpc/com.atproto.simplespace.createSpace",
      "/xrpc/com.atproto.simplespace.updateSpace",
    ]);
    for (const { body } of requests) {
      expect(body).not.toHaveProperty("policy");
      expect(body?.readPolicy).toEqual({ $type: "com.atproto.simplespace.defs#memberListPolicy" });
      expect(body?.writePolicy).toEqual({ $type: "com.atproto.simplespace.defs#publicPolicy" });
    }
  });

  test("getSpace preserves separate managing applications through settings editing", async () => {
    response = {
      uri: space,
      readPolicy: {
        $type: "com.atproto.simplespace.defs#managingAppPolicy",
        managingApp: "did:web:read.example#service",
      },
      writePolicy: {
        $type: "com.atproto.simplespace.defs#managingAppPolicy",
        managingApp: "did:web:write.example#service",
      },
      appAccess: { $type: "com.atproto.simplespace.defs#open" },
    };
    const info = (await getSimpleSpace(auth, space))!;
    const draft = simpleSpaceSettingsFromInfo(info)!;
    expect(parseSimpleSpaceSettings(draft)).toEqual({
      readPolicy: { kind: "managing-app", managingApp: "did:web:read.example#service" },
      writePolicy: { kind: "managing-app", managingApp: "did:web:write.example#service" },
      appAccess: { kind: "open" },
    });
    const unknown = {
      ...info,
      writePolicy: { kind: "unknown" as const, type: "app.example.policy" },
    };
    expect(simpleSpaceSettingsFromInfo(unknown)).toBeUndefined();
  });

  test("default settings restrict both access policies and validate each managing app", () => {
    const draft = defaultSimpleSpaceSettings();
    expect(parseSimpleSpaceSettings(draft)).toEqual({
      readPolicy: { kind: "member-list" },
      writePolicy: { kind: "member-list" },
      appAccess: { kind: "open" },
    });
    draft.write = { policy: "managing-app", managingApp: "invalid" };
    expect(() => parseSimpleSpaceSettings(draft)).toThrow("Write access managing app");
  });

  test("putMember and listMembers preserve every read/write combination", async () => {
    const members = [
      { did, read: true, write: false },
      { did, read: false, write: true },
      { did, read: true, write: true },
      { did, read: false, write: false },
    ];
    for (const member of members) {
      await putSimpleSpaceMember(auth, space, member);
      expect(requests.at(-1)).toEqual({
        path: "/xrpc/com.atproto.simplespace.putMember",
        body: { space, ...member },
      });
    }
    response = { members };
    expect((await listSimpleSpaceMembers(auth, space)).members).toEqual(members);
  });

  test("member writes require authority ownership and member reads reject missing flags", async () => {
    await expect(
      putSimpleSpaceMember(auth, "at://did:web:other.example/space/app.example.group/test", {
        did,
        read: true,
        write: false,
      }),
    ).rejects.toThrow("Only the Space authority");
    expect(requests).toHaveLength(0);
    response = { members: [{ did, read: true }] };
    await expect(listSimpleSpaceMembers(auth, space)).rejects.toThrow(
      "invalid SimpleSpace member access",
    );
  });
});
