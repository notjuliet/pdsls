import { createMemo } from "solid-js";

/** Returns a memo that latches to `true` once `ready()` is true, and never reverts. */
export const createLatch = (ready: () => boolean) =>
  createMemo<true | undefined>((prev) => prev || (ready() ? true : undefined));
