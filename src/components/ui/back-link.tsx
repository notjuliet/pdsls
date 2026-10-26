import { A } from "@solidjs/router";
import type { JSX } from "solid-js";

/** A muted link back up a level, e.g. to all spaces or to a repo's blobs. */
export const BackLink = (props: { href: string; class?: string; children: JSX.Element }) => (
  <A
    href={props.href}
    class={`flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-200/80 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-200 ${props.class ?? ""}`}
  >
    <span class="iconify lucide--arrow-left" />
    {props.children}
  </A>
);
