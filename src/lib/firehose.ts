/* Partially sourced from https://github.com/skyware-js/firehose
 * Mozilla Public License 2.0
 */

import { readCar as createCarIterator } from "@atcute/car";
import { decode, decodeFirst, fromBytes, toCidLink } from "@atcute/cbor";
import type { At, ComAtprotoSyncSubscribeRepos } from "@atcute/client/lexicons";

type Listener<T = any> = (data: T) => void;

class EventEmitter {
  private events: { [event: string]: Listener[] } = {};

  // Register an event listener
  on<T>(event: string, listener: Listener<T>): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  // Emit an event with data
  emit<T>(event: string, data?: T): void {
    if (this.events[event]) {
      this.events[event].forEach((listener) => listener(data));
    }
  }

  // Remove an event listener
  off<T>(event: string, listener: Listener<T>): void {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((l) => l !== listener);
    }
  }

  // Remove all listeners for a specific event
  removeAllListeners(event: string): void {
    if (this.events[event]) {
      delete this.events[event];
    }
  }
}

/**
 * Options for the Firehose class.
 */
export interface FirehoseOptions {
  /**
   * The Relay to connect to.
   */
  relay?: string;
  /**
   * The cursor to listen from. If not provided, the firehose will start from the latest event.
   */
  cursor?: string;
}

export class Firehose extends EventEmitter {
  /** The relay to connect to. */
  public relay: string;

  /** WebSocket connection to the relay. */
  public ws?: WebSocket;

  /** The current cursor. */
  public cursor = "";

  /**
   * Creates a new Firehose instance.
   * @param options Optional configuration.
   */
  constructor(options: FirehoseOptions = {}) {
    super();
    this.relay = options.relay ?? "wss://bsky.network";
    this.cursor = options.cursor ?? "";
  }

  /**
   * Opens a WebSocket connection to the relay.
   */
  start() {
    const cursorQueryParameter = this.cursor ? `?cursor=${this.cursor}` : "";
    this.ws = new WebSocket(
      `${this.relay}/xrpc/com.atproto.sync.subscribeRepos${cursorQueryParameter}`,
    );
    this.ws.binaryType = "arraybuffer";

    this.ws.addEventListener("open", () => {
      this.emit("open");
    });

    this.ws.addEventListener("message", (event) => {
      try {
        const message = this.parseMessage(event.data);
        if ("seq" in message && message.seq && !isNaN(message.seq)) {
          this.cursor = `${message.seq}`;
        }
        switch (message.$type) {
          case "com.atproto.sync.subscribeRepos#handle":
            this.emit("handle", message);
            break;
          case "com.atproto.sync.subscribeRepos#tombstone":
            this.emit("tombstone", message);
            break;
          case "com.atproto.sync.subscribeRepos#migrate":
            this.emit("migrate", message);
            break;
          case "com.atproto.sync.subscribeRepos#identity":
            this.emit("identity", message);
            break;
          case "com.atproto.sync.subscribeRepos#info":
            this.emit("info", message);
            break;
          case "com.atproto.sync.subscribeRepos#commit":
            this.emit("commit", message);
            break;
          default:
            this.emit("unknown", message);
            break;
        }
      } catch (error) {
        this.emit("error", { cursor: this.cursor, error });
      }
    });

    this.ws.addEventListener("close", () => {
      this.emit("close", this.cursor);
    });

    this.ws.addEventListener("error", (error) => {
      this.emit("websocketError", { cursor: this.cursor, error });
    });
  }

  /**
   * Closes the WebSocket connection.
   */
  close() {
    this.ws?.close();
  }

  /** Emitted when the connection is opened. */
  override on(event: "open", listener: () => void): this;
  /** Emitted when the connection is closed. */
  override on(event: "close", listener: (cursor: string) => void): this;
  /** Emitted when an error occurs while handling a message. */
  override on(
    event: "error",
    listener: ({ cursor, error }: { cursor: string; error: Error }) => void,
  ): this;
  /** Emitted when an error occurs within the websocket. */
  override on(
    event: "websocketError",
    listener: ({ cursor, error }: { cursor: string; error: unknown }) => void,
  ): this;
  /** Emitted when an unknown message is received. */
  override on(event: "unknown", listener: (message: unknown) => void): this;
  /**
   * Represents an update of an account's handle, or transition to/from invalid state.
   * @deprecated Use on("identity") instead.
   */
  override on(
    event: "handle",
    listener: (
      message: ComAtprotoSyncSubscribeRepos.Handle & {
        $type: "com.atproto.sync.subscribeRepos#handle";
      },
    ) => void,
  ): this;
  /**
   * Represents an account moving from one PDS instance to another.
   * @deprecated Use on("account") instead.
   */
  override on(
    event: "migrate",
    listener: (
      message: ComAtprotoSyncSubscribeRepos.Migrate & {
        $type: "com.atproto.sync.subscribeRepos#migrate";
      },
    ) => void,
  ): this;
  /**
   * Indicates that an account has been deleted.
   * @deprecated Use on("account") instead.
   */
  override on(
    event: "tombstone",
    listener: (
      message: ComAtprotoSyncSubscribeRepos.Tombstone & {
        $type: "com.atproto.sync.subscribeRepos#tombstone";
      },
    ) => void,
  ): this;
  /**
   * Represents a change to an account's identity.
   * Could be an updated handle, signing key, or pds hosting endpoint.
   */
  override on(
    event: "identity",
    listener: (
      message: ComAtprotoSyncSubscribeRepos.Identity & {
        $type: "com.atproto.sync.subscribeRepos#identity";
      },
    ) => void,
  ): this;
  /** Represents a commit to a user's repository. */
  override on(event: "commit", listener: (message: ParsedCommit) => void): this;
  /** An informational message from the relay. */
  override on(
    event: "info",
    listener: (
      message: ComAtprotoSyncSubscribeRepos.Info & {
        $type: "com.atproto.sync.subscribeRepos#info";
      },
    ) => void,
  ): this;
  override on(event: string, listener: (...args: any[]) => void): this {
    super.on(event, listener);
    return this;
  }

  private parseMessage(
    data: ArrayBuffer,
  ): ParsedCommit | { $type: string; seq?: number } {
    const [header, remainder] = decodeFirst(new Uint8Array(data));
    const [body, remainder2] = decodeFirst(remainder);
    if (remainder2.length > 0) {
      throw new Error("Excess bytes in message");
    }

    const { t, op } = parseHeader(header);

    if (op === -1) {
      throw new Error(`Error: ${body.message}\nError code: ${body.error}`);
    }

    if (t === "#commit") {
      const commit = body as ComAtprotoSyncSubscribeRepos.Commit;

      // A commit can contain no changes
      if (!("blocks" in commit) || !commit.blocks.$bytes.length) {
        return {
          $type: "com.atproto.sync.subscribeRepos#commit",
          ...commit,
          blocks: new Uint8Array(),
          ops: [],
        } satisfies ParsedCommit;
      }

      const blocks = fromBytes(commit.blocks);
      const car = readCar(blocks);
      const ops: Array<RepoOp> = commit.ops
        .map((op) => {
          const action: "create" | "update" | "delete" = op.action as any;
          if (action === "create" || action === "update") {
            if (!op.cid) return;
            const record = car.get(op.cid.$link);
            if (!record) return;
            return { action, path: op.path, cid: op.cid.$link, record };
          } else if (action === "delete") {
            return { action, path: op.path };
          } else {
            throw new Error(`Unknown action: ${action}`);
          }
        })
        .filter((op): op is Exclude<typeof op, undefined> => !!op);
      return {
        $type: "com.atproto.sync.subscribeRepos#commit",
        ...commit,
        blocks,
        ops,
      } satisfies ParsedCommit;
    }
    return { $type: `com.atproto.sync.subscribeRepos${t}`, ...body };
  }
}

/**
 * Represents a `create` or `update` repository operation.
 */
export interface CreateOrUpdateOp {
  action: "create" | "update";

  /** The record's path in the repository. */
  path: string;

  /** The record's CID. */
  cid: string;

  /** The record itself. */
  record: {};
}

/**
 * Represents a `delete` repository operation.
 */
export interface DeleteOp {
  action: "delete";

  /** The record's path in the repository. */
  path: string;
}

/** A repository operation. */
export type RepoOp = CreateOrUpdateOp | DeleteOp;

/**
 * Represents an update of repository state.
 */
export interface ParsedCommit {
  $type: "com.atproto.sync.subscribeRepos#commit";
  /** The stream sequence number of this message. */
  seq: number;
  /** Indicates that this commit contained too many ops, or data size was too large. Consumers will need to make a separate request to get missing data. */
  tooBig: boolean;
  /** The repo this event comes from. */
  repo: string;
  /** Repo commit object CID. */
  commit: At.CIDLink;
  /** The rev of the emitted commit. Note that this information is also in the commit object included in blocks, unless this is a tooBig event. */
  rev: string;
  /** The rev of the last emitted commit from this repo (if any). */
  since: string | null;
  /** CAR file containing relevant blocks, as a diff since the previous repo state. */
  blocks: Uint8Array;
  /** List of repo mutation operations in this commit (eg, records created, updated, or deleted). */
  ops: Array<RepoOp>;
  /** List of new blobs (by CID) referenced by records in this commit. */
  blobs: At.CIDLink[];
  /** Timestamp of when this message was originally broadcast. */
  time: string;
}

function parseHeader(header: any): { t: string; op: 1 | -1 } {
  if (
    !header ||
    typeof header !== "object" ||
    !header.t ||
    typeof header.t !== "string" ||
    !header.op ||
    typeof header.op !== "number"
  ) {
    throw new Error("Invalid header received");
  }
  return { t: header.t, op: header.op };
}

function readCar(buffer: Uint8Array): Map<At.CID, unknown> {
  const records = new Map<At.CID, unknown>();
  for (const { cid, bytes } of createCarIterator(buffer).iterate()) {
    records.set(toCidLink(cid).$link, decode(bytes));
  }
  return records;
}
