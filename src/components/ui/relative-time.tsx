import type { JSX } from "solid-js";

import { localDateFromTimestamp, relativeTimeFromTimestamp } from "../../lib/format.js";
import Tooltip from "./tooltip.jsx";

/**
 * "3 days ago" or "in 2 weeks", with the exact time in a tooltip. Used at the end of a row, so the
 * tooltip lines up with the text's right edge rather than running off the page.
 */
export const RelativeTime = (props: {
  timestamp: number;
  /** Before the exact time in the tooltip, like "Expires". */
  label?: string;
  /** Shown before the relative time, like an icon. */
  icon?: JSX.Element;
  class?: string;
}) => (
  <Tooltip
    alignEnd
    text={`${props.label ? `${props.label} ` : ""}${localDateFromTimestamp(props.timestamp)}`}
  >
    <span class={`flex items-baseline gap-1 ${props.class ?? ""}`}>
      {props.icon}
      {relativeTimeFromTimestamp(props.timestamp)}
    </span>
  </Tooltip>
);
