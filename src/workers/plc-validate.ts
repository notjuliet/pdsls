import { processIndexedEntryLog } from "@atcute/did-plc";

self.onmessage = async (e: MessageEvent<{ did: string; logs: any }>) => {
  const { did, logs } = e.data;
  try {
    await processIndexedEntryLog(did as any, logs);
    self.postMessage({ valid: true });
  } catch {
    self.postMessage({ valid: false });
  }
};
