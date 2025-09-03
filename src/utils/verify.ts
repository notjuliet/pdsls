import { Client } from "@atcute/client";

import * as CAR from "@atcute/car";
import { CarReader } from "@atcute/car/v4";
import * as CBOR from "@atcute/cbor";
import * as CID from "@atcute/cid";
import { type FoundPublicKey, getPublicKeyFromDidController, verifySig } from "@atcute/crypto";
import { type DidDocument, getAtprotoVerificationMaterial } from "@atcute/identity";
import { Did } from "@atcute/lexicons";
import { toSha256 } from "@atcute/uint8array";

import { type AddressedAtUri, parseAddressedAtUri } from "./types/at-uri";

export interface VerifyError {
  message: string;
  detail?: unknown;
}

export interface VerifyResult {
  errors: VerifyError[];
}

export interface VerifyOptions {
  rpc: Client;
  uri: string;
  cid: string;
  record: unknown;
  didDoc: DidDocument;
}

export const verifyRecord = async (opts: VerifyOptions): Promise<VerifyResult> => {
  const errors: VerifyError[] = [];

  // verify cid can be parsed
  try {
    CID.fromString(opts.cid);
  } catch (e) {
    errors.push({ message: `provided cid is invalid`, detail: e });
  }

  // verify record content matches cid
  let cbor: Uint8Array;
  {
    cbor = CBOR.encode(opts.record);

    const cid = await CID.create(CID.CODEC_DCBOR, cbor);
    const cidString = CID.toString(cid);

    if (cidString !== opts.cid) {
      errors.push({ message: `record content does not match cid` });
    }
  }

  // verify at-uri is valid
  let uri: AddressedAtUri;
  try {
    uri = parseAddressedAtUri(opts.uri);

    if (uri.repo !== opts.didDoc.id) {
      errors.push({ message: `repo in at-uri does not match did document` });
    }
  } catch (err) {
    errors.push({ message: `provided at-uri is invalid`, detail: err });
    return { errors };
  }

  // grab public key from did document
  let publicKey: FoundPublicKey;
  try {
    const controller = getAtprotoVerificationMaterial(opts.didDoc);
    if (!controller) {
      errors.push({
        message: `did document does not contain verification material`,
      });
      return { errors };
    }

    publicKey = getPublicKeyFromDidController(controller);
  } catch (err) {
    errors.push({
      message: `failed to get public key from did document`,
      detail: err,
    });
    return { errors };
  }

  // grab the raw record blocks from the pds
  let car: Uint8Array;
  const { ok, data } = await opts.rpc.get("com.atproto.sync.getRecord", {
    params: {
      did: opts.didDoc.id as Did,
      collection: uri.collection,
      rkey: uri.rkey,
    },
    as: "bytes",
  });
  if (!ok) {
    errors.push({ message: `failed to fetch car from pds`, detail: data.error });
    return { errors };
  } else {
    car = data;
  }

  // read the car
  let blockmap: CAR.BlockMap;
  let commit: CAR.Commit;

  try {
    const reader = CarReader.fromUint8Array(car);
    if (reader.header.data.roots.length !== 1) {
      errors.push({ message: `car must have exactly one root` });
      return { errors };
    }

    blockmap = new Map();
    for (const entry of reader) {
      const cidString = CID.toString(entry.cid);

      // Verify that `bytes` matches its associated CID
      const expectedCid = CID.toString(await CID.create(entry.cid.codec as 85 | 113, entry.bytes));
      if (cidString !== expectedCid) {
        errors.push({
          message: `cid does not match bytes`,
          detail: { cid: cidString, expectedCid },
        });
      }

      blockmap.set(cidString, entry);
    }

    if (blockmap.size === 0) {
      errors.push({ message: `car must have at least one block` });
      return { errors };
    }

    commit = CAR.readBlock(blockmap, reader.header.data.roots[0], CAR.isCommit);
  } catch (err) {
    errors.push({ message: `failed to read car`, detail: err });
    return { errors };
  }

  // verify did in commit matches the did in the at-uri
  if (commit.did !== opts.didDoc.id) {
    errors.push({ message: `did in commit does not match did document` });
  }

  // verify signature contained in commit is valid
  {
    const { sig, ...unsigned } = commit;

    const data = CBOR.encode(unsigned);
    const valid = await verifySig(
      publicKey,
      CBOR.fromBytes(sig) as Uint8Array<ArrayBuffer>,
      data as Uint8Array<ArrayBuffer>,
    );

    if (!valid) {
      errors.push({ message: `signature verification failed` });
    }
  }

  // verify the commit is a valid commit
  try {
    const result = await dfs(blockmap, commit.data.$link, opts.cid);
    if (!result.found) {
      errors.push({ message: `could not find record in car` });
    }
  } catch (err) {
    errors.push({ message: `failed to iterate over car`, detail: err });
  }

  return { errors };
};

interface DfsResult {
  found: boolean;
  min?: string;
  max?: string;
  depth?: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const dfs = async (
  blockmap: CAR.BlockMap,
  from: string | undefined,
  target: string,
  visited = new Set<string>(),
): Promise<DfsResult> => {
  // If there's no starting point, return empty state
  if (from == null) {
    return { found: false };
  }

  // Check for cycles
  {
    if (visited.has(from)) {
      throw new Error(`cycle detected; cid=${from}`);
    }

    visited.add(from);
  }

  // Get the block data
  let node: CAR.MstNode;
  {
    const entry = blockmap.get(from);
    if (!entry) {
      return { found: false };
    }

    const decoded = CBOR.decode(entry.bytes);
    if (!CAR.isMstNode(decoded)) {
      throw new Error(`invalid mst node; cid=${from}`);
    }

    node = decoded;
  }

  // Recursively process the left child
  const left = await dfs(blockmap, node.l?.$link, target, visited);

  let key = "";
  let found = left.found;
  let depth: number | undefined;
  let firstKey: string | undefined;
  let lastKey: string | undefined;

  // Process all entries in this node
  for (const entry of node.e) {
    if (entry.v.$link === target) {
      found = true;
    }

    // Construct the key by truncating and appending
    key = key.substring(0, entry.p) + decoder.decode(CBOR.fromBytes(entry.k));

    // Calculate depth based on leading zeros in the hash
    const keyDigest = await toSha256(encoder.encode(key) as Uint8Array<ArrayBuffer>);
    let zeroCount = 0;

    outerLoop: for (const byte of keyDigest) {
      for (let bit = 7; bit >= 0; bit--) {
        if (((byte >> bit) & 1) !== 0) {
          break outerLoop;
        }
        zeroCount++;
      }
    }

    const thisDepth = Math.floor(zeroCount / 2);

    // Ensure consistent depth
    if (depth === undefined) {
      depth = thisDepth;
    } else if (depth !== thisDepth) {
      throw new Error(`node has entries with different depths; cid=${from}`);
    }

    // Track first and last keys
    if (lastKey === undefined) {
      firstKey = key;
      lastKey = key;
    }

    // Check key ordering
    if (lastKey > key) {
      throw new Error(`entries are out of order; cid=${from}`);
    }

    // Process right child
    const right = await dfs(blockmap, entry.t?.$link, target, visited);

    // Check ordering with right subtree
    if (right.min && right.min < lastKey) {
      throw new Error(`entries are out of order; cid=${from}`);
    }

    found ||= right.found;

    // Check depth ordering
    if (left.depth !== undefined && left.depth >= thisDepth) {
      throw new Error(`depths are out of order; cid=${from}`);
    }

    if (right.depth !== undefined && right.depth >= thisDepth) {
      throw new Error(`depths are out of order; cid=${from}`);
    }

    // Update last key based on right subtree
    lastKey = right.max ?? key;
  }

  // Check ordering with left subtree
  if (left.max && firstKey && left.max > firstKey) {
    throw new Error(`entries are out of order; cid=${from}`);
  }

  return {
    found,
    min: firstKey,
    max: lastKey,
    depth,
  };
};
