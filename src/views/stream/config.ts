import { localDateFromTimestamp } from "../../lib/format";

export type StreamType = "jetstream" | "firehose" | "spacedust" | "plc";

type FormField = {
  name: string;
  label: string;
  type: "text" | "checkbox" | "tags";
  datetimePicker?: boolean;
  /** For checkboxes: on unless the URL turns it off. */
  defaultChecked?: boolean;
  placeholder?: string;
  searchParam: string;
};

type RecordInfo = {
  type: string;
  did?: string;
  collection?: string;
  rkey?: string;
  action?: string;
  time?: string;
};

type StreamConfig = {
  label: string;
  /** What the stream carries, in a word or two, under its name on the homepage and in search. */
  summary: string;
  description: string;
  defaultInstance: string;
  fields: FormField[];
  cborFrames: boolean;
  buildUrl: (instance: string, formData: FormData) => string;
  parseRecord: (record: any) => RecordInfo;
  collectionsLabel: string;
  /** What the top list counts an event under, when it isn't the event's collection. */
  topKey?: (record: any) => string | undefined;
  /**
   * The types the stream can send, as its rows show them, given the form it was connected with.
   * They get filter chips from the start; a type not listed gets one when it first comes in.
   */
  eventTypes: (formData: FormData) => string[];
  /** Whether to show an event, given the form it was connected with. */
  filter?: (record: any, formData: FormData) => boolean;
};

/** PDSes that create accounts in bulk, drowning out everything else in the PLC stream. */
const SPAM_PDS_HOSTS = ["pds.trump.com"];

const plcPdsHost = (rec: any) => {
  const op = rec.operation ?? {};
  const endpoint = op.services?.atproto_pds?.endpoint ?? op.service;
  if (!endpoint) return undefined;
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
};

/** Whether a checkbox is on, given its value from the URL or form. */
export const isChecked = (field: FormField, value: unknown) =>
  value === "on" || (!!field.defaultChecked && value !== "off");

export const STREAM_CONFIGS: Record<StreamType, StreamConfig> = {
  jetstream: {
    label: "Jetstream",
    summary: "Simplified events",
    description: "A simplified event stream with support for collection and DID filtering.",
    defaultInstance: "wss://jetstream1.us-east.bsky.network/subscribe",
    cborFrames: false,
    collectionsLabel: "Top collections",
    eventTypes: (formData) =>
      formData.get("allEvents") === "on"
        ? ["create", "update", "delete", "identity", "account"]
        : ["create", "update", "delete"],
    fields: [
      {
        name: "collections",
        label: "Collections",
        type: "tags",
        placeholder: "app.bsky.feed.post",
        searchParam: "collections",
      },
      {
        name: "dids",
        label: "DIDs",
        type: "tags",
        placeholder: "did:plc:xyz...",
        searchParam: "dids",
      },
      {
        name: "cursor",
        label: "Cursor",
        type: "text",
        placeholder: "Leave empty for live-tail",
        searchParam: "cursor",
        datetimePicker: true,
      },
      {
        name: "allEvents",
        label: "Show account and identity events",
        type: "checkbox",
        searchParam: "allEvents",
      },
    ],
    buildUrl: (instance, formData) => {
      let url = instance + "?";

      const collections = formData.get("collections")?.toString().split(",");
      collections?.forEach((c) => {
        if (c.trim().length) url += `wantedCollections=${c.trim()}&`;
      });

      const dids = formData.get("dids")?.toString().split(",");
      dids?.forEach((d) => {
        if (d.trim().length) url += `wantedDids=${d.trim()}&`;
      });

      const cursor = formData.get("cursor")?.toString();
      if (cursor?.length) url += `cursor=${cursor}&`;

      return url.replace(/[&?]$/, "");
    },
    parseRecord: (rec) => {
      const collection = rec.commit?.collection || rec.kind;
      const rkey = rec.commit?.rkey;
      const action = rec.commit?.operation;
      const time = rec.time_us ? localDateFromTimestamp(rec.time_us / 1000) : undefined;
      return { type: rec.kind, did: rec.did, collection, rkey, action, time };
    },
  },

  firehose: {
    label: "Firehose",
    summary: "Raw events",
    description: "The raw event stream from a relay or PDS.",
    defaultInstance: "wss://bsky.network",
    cborFrames: true,
    collectionsLabel: "Top collections",
    eventTypes: () => ["create", "update", "delete", "identity", "account", "sync"],
    fields: [
      {
        name: "cursor",
        label: "Cursor",
        type: "text",
        placeholder: "Leave empty for live-tail",
        searchParam: "cursor",
      },
    ],
    buildUrl: (instance, _formData) => {
      let url = instance;
      url = url.replace("/xrpc/com.atproto.sync.subscribeRepos", "");
      if (!(url.startsWith("wss://") || url.startsWith("ws://"))) {
        url = "wss://" + url;
      }
      return url;
    },
    parseRecord: (rec) => {
      const type = rec.$type?.split("#").pop() || rec.$type;
      const did = rec.repo ?? rec.did;
      const pathParts = rec.op?.path?.split("/") || [];
      const collection = pathParts[0];
      const rkey = pathParts[1];
      const time = rec.time ? localDateFromTimestamp(Date.parse(rec.time)) : undefined;
      return { type, did, collection, rkey, action: rec.op?.action, time };
    },
  },

  spacedust: {
    label: "Spacedust",
    summary: "Backlinks",
    description: "A stream of links showing interactions across the network.",
    defaultInstance: "wss://spacedust.microcosm.blue/subscribe",
    cborFrames: false,
    collectionsLabel: "Top sources",
    // Spacedust drops deletes for now, so links only ever come in as creates.
    eventTypes: () => ["create"],
    fields: [
      {
        name: "sources",
        label: "Sources",
        type: "tags",
        placeholder: "app.bsky.graph.follow:subject",
        searchParam: "sources",
      },
      {
        name: "subjectDids",
        label: "Subject DIDs",
        type: "tags",
        placeholder: "did:plc:xyz...",
        searchParam: "subjectDids",
      },
      {
        name: "subjects",
        label: "Subjects",
        type: "tags",
        placeholder: "at://did:plc:xyz.../app.bsky.feed.post/abc",
        searchParam: "subjects",
      },
      {
        name: "instant",
        label: "Instant mode (bypass 21s delay buffer)",
        type: "checkbox",
        searchParam: "instant",
      },
    ],
    buildUrl: (instance, formData) => {
      let url = instance + "?";

      const sources = formData.get("sources")?.toString().split(",");
      sources?.forEach((s) => {
        if (s.trim().length) url += `wantedSources=${s.trim()}&`;
      });

      const subjectDids = formData.get("subjectDids")?.toString().split(",");
      subjectDids?.forEach((d) => {
        if (d.trim().length) url += `wantedSubjectDids=${d.trim()}&`;
      });

      const subjects = formData.get("subjects")?.toString().split(",");
      subjects?.forEach((s) => {
        if (s.trim().length) url += `wantedSubjects=${encodeURIComponent(s.trim())}&`;
      });

      const instant = formData.get("instant")?.toString();
      if (instant === "on") url += `instant=true&`;

      return url.replace(/[&?]$/, "");
    },
    parseRecord: (rec) => {
      const source = rec.link?.source;
      const sourceRecord = rec.link?.source_record;
      const uriParts = sourceRecord?.replace("at://", "").split("/") || [];
      const did = uriParts[0];
      const collection = uriParts[1];
      const rkey = uriParts[2];
      return {
        type: rec.kind,
        did,
        collection: source || collection,
        rkey,
        action: rec.link?.operation,
        time: undefined,
      };
    },
  },

  plc: {
    label: "PLC",
    summary: "Operations",
    description: "The stream of did:plc operations from the PLC directory.",
    defaultInstance: "wss://plc.directory/export/stream",
    cborFrames: false,
    collectionsLabel: "Top PDSes",
    eventTypes: () => ["create", "update", "tombstone"],
    fields: [
      {
        name: "cursor",
        label: "Cursor",
        type: "text",
        placeholder: "Leave empty for live-tail",
        searchParam: "cursor",
      },
      {
        name: "hideSpam",
        label: "Hide spam",
        type: "checkbox",
        searchParam: "hideSpam",
        defaultChecked: true,
      },
    ],
    buildUrl: (instance, formData) => {
      const cursor = formData.get("cursor")?.toString();
      return cursor?.length ? `${instance}?cursor=${cursor}` : instance;
    },
    parseRecord: (rec) => {
      const op = rec.operation ?? {};
      // Older operations used "create" and a top-level handle; newer ones are all "plc_operation".
      const action =
        op.type === "plc_tombstone" ? "tombstone" : op.prev === null ? "create" : "update";
      const handle = op.alsoKnownAs?.[0]?.replace("at://", "") ?? op.handle;
      const time = rec.createdAt ? localDateFromTimestamp(Date.parse(rec.createdAt)) : undefined;
      return { type: action, did: rec.did, collection: handle, action, time };
    },
    topKey: plcPdsHost,
    filter: (rec, formData) =>
      formData.get("hideSpam") !== "on" || !SPAM_PDS_HOSTS.includes(plcPdsHost(rec) ?? ""),
  },
};

export const STREAM_TYPES = Object.keys(STREAM_CONFIGS) as StreamType[];

export const getStreamType = (value: string | string[] | undefined): StreamType => {
  const type = Array.isArray(value) ? value[0] : value;
  return STREAM_TYPES.includes(type as StreamType) ? (type as StreamType) : "jetstream";
};
