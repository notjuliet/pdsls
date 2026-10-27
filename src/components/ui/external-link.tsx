import type { JSX } from "solid-js";

/** A text link that opens in a new tab, marked with an external-link icon. Long text is cut off. */
export const ExternalLink = (props: { href: string; children: JSX.Element }) => (
  <a
    href={props.href}
    target="_blank"
    rel="noopener"
    class="flex w-fit max-w-full items-center gap-1 text-sm text-blue-500 hover:underline dark:text-blue-400"
  >
    <span class="truncate">{props.children}</span>
    <span class="iconify lucide--external-link shrink-0" />
  </a>
);
