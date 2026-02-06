import { JSX, Show } from "solid-js";
import { canHover } from "../layout";

const Tooltip = (props: { text: string; shortcut?: string; children: JSX.Element }) => (
  <span class="group/tooltip relative inline-flex items-center">
    {props.children}
    <Show when={canHover}>
      <span
        style={`transform: translate(-50%, 28px)`}
        class={`dark:shadow-dark-700 dark:bg-dark-300 pointer-events-none absolute left-[50%] z-20 hidden min-w-fit rounded border-[0.5px] border-neutral-300 bg-white p-1 text-center font-sans text-xs font-normal whitespace-nowrap text-neutral-900 shadow-md select-none group-hover/tooltip:inline first-letter:capitalize dark:border-neutral-600 dark:text-neutral-200`}
      >
        {props.text}
        <Show when={props.shortcut}>
          <kbd class="ml-2 rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] dark:border-neutral-600 dark:bg-neutral-700">
            {props.shortcut}
          </kbd>
        </Show>
      </span>
    </Show>
  </span>
);

export default Tooltip;
