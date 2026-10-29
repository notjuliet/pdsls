import { fromUint8Array as readCar } from "@atcute/car";
import { decode, decodeFirst, fromBytes, toCidLink } from "@atcute/cbor";

const PREFIX = "com.atproto.sync.subscribeRepos";

const readRecords = (blocks: Uint8Array) => {
  const records = new Map<string, unknown>();
  // Blocks aren't hashed against their CIDs, to keep a busy stream cheap.
  for (const { cid, bytes } of readCar(blocks, { verifyBlocks: false })) {
    records.set(toCidLink(cid).$link, decode(bytes));
  }
  return records;
};

const decodeCommit = (body: any) => {
  const records = body.blocks?.$bytes?.length ? readRecords(fromBytes(body.blocks)) : new Map();
  const ops = [];
  for (const op of body.ops ?? []) {
    const prev = op.prev ? { prev: op.prev.$link } : {};
    if (op.action === "delete") {
      ops.push({ action: op.action, path: op.path, ...prev });
      continue;
    }
    if (op.action !== "create" && op.action !== "update") {
      throw new Error(`Unknown action: ${op.action}`);
    }
    const record = op.cid && records.get(op.cid.$link);
    if (!record) continue;
    ops.push({ action: op.action, path: op.path, cid: op.cid.$link, ...prev, record });
  }
  return ops;
};

/**
 * Turns one subscribeRepos frame into the events the stream lists: one per commit
 * operation, or the identity, account or sync event as it is.
 */
export const decodeFirehoseFrame = (frame: Uint8Array): Record<string, unknown>[] => {
  const [header, remainder] = decodeFirst(frame);
  const [body, rest] = decodeFirst(remainder);
  if (rest.length > 0) throw new Error("Excess bytes in message");
  if (typeof header?.op !== "number") throw new Error("Invalid header received");
  if (header.op === -1) throw new Error(`${body.error}: ${body.message}`);
  if (typeof header.t !== "string") throw new Error("Invalid header received");

  const $type = `${PREFIX}${header.t}`;
  switch (header.t) {
    case "#commit":
      return decodeCommit(body).map((op) => ({
        $type,
        repo: body.repo,
        seq: body.seq,
        time: body.time,
        rev: body.rev,
        since: body.since,
        op,
      }));
    case "#sync":
      return [{ $type, did: body.did, rev: body.rev, seq: body.seq, time: body.time }];
    case "#identity":
    case "#account":
      return [{ $type, ...body }];
    default:
      return [];
  }
};
