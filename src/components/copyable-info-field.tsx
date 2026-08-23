import { canHover } from "../layout.jsx";
import { addToClipboard } from "../utils/copy.js";

export const CopyableInfoField = (props: { label: string; value: string }) => (
  <div>
    <p class="font-semibold">{props.label}</p>
    <button
      class="group flex w-full items-center gap-1 text-left text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-200"
      onClick={() => addToClipboard(props.value)}
    >
      <span class="truncate" dir="rtl">
        {props.value}
      </span>
      <span
        classList={{
          "iconify lucide--copy shrink-0": true,
          "opacity-0 group-hover:opacity-100": canHover,
        }}
      />
    </button>
  </div>
);
