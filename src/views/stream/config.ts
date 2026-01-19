import { localDateFromTimestamp } from "../../utils/date";

export type StreamType = "jetstream" | "firehose" | "spacedust";

export type FormField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "checkbox";
  placeholder?: string;
  searchParam: string;
};

export type RecordInfo = {
  type: string;
  did?: string;
  collection?: string;
  rkey?: string;
  action?: string;
  time?: string;
};

export type StreamConfig = {
  label: string;
  icon: string;
  defaultInstance: string;
  fields: FormField[];
  useFirehoseLib: boolean;
  buildUrl: (instance: string, formData: FormData) => string;
  parseRecord: (record: any) => RecordInfo;
  showEventTypes: boolean;
  collectionsLabel: string;
};

export const STREAM_CONFIGS: Record<StreamType, StreamConfig> = {
  jetstream: {
    label: "Jetstream",
    icon: "lucide--radio-tower",
    defaultInstance: "wss://jetstream1.us-east.bsky.network/subscribe",
    useFirehoseLib: false,
    showEventTypes: true,
    collectionsLabel: "Top Collections",
    fields: [
      {
        name: "collections",
        label: "Collections",
        type: "textarea",
        placeholder: "Comma-separated list of collections",
        searchParam: "collections",
      },
      {
        name: "dids",
        label: "DIDs",
        type: "textarea",
        placeholder: "Comma-separated list of DIDs",
        searchParam: "dids",
      },
      {
        name: "cursor",
        label: "Cursor",
        type: "text",
        placeholder: "Leave empty for live-tail",
        searchParam: "cursor",
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
    icon: "lucide--rss",
    defaultInstance: "wss://bsky.network",
    useFirehoseLib: true,
    showEventTypes: true,
    collectionsLabel: "Top Collections",
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
    icon: "lucide--link",
    defaultInstance: "wss://spacedust.microcosm.blue/subscribe",
    useFirehoseLib: false,
    showEventTypes: false,
    collectionsLabel: "Top Sources",
    fields: [
      {
        name: "sources",
        label: "Sources",
        type: "textarea",
        placeholder: "e.g. app.bsky.graph.follow:subject",
        searchParam: "sources",
      },
      {
        name: "subjectDids",
        label: "Subject DIDs",
        type: "textarea",
        placeholder: "Comma-separated list of DIDs",
        searchParam: "subjectDids",
      },
      {
        name: "subjects",
        label: "Subjects",
        type: "textarea",
        placeholder: "Comma-separated list of AT URIs",
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
};

export const STREAM_TYPES = Object.keys(STREAM_CONFIGS) as StreamType[];

export const getStreamType = (pathname: string): StreamType => {
  if (pathname === "/firehose") return "firehose";
  if (pathname === "/spacedust") return "spacedust";
  return "jetstream";
};
