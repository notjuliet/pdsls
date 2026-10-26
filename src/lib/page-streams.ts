import { createSignal } from "solid-js";

/** A stream preset for the page being viewed, e.g. Jetstream filtered to the open repo. */
export interface PageStream {
  href: string;
  /** What the stream is filtered to, e.g. a handle or an NSID. */
  target: string;
}

/** Streams for the current page, which the search dropdown offers in place of the generic ones. */
export const [pageStreams, setPageStreams] = createSignal<{
  jetstream?: PageStream;
  firehose?: PageStream;
  spacedust?: PageStream;
}>({});
