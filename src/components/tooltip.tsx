import { JSX, Show } from "solid-js";
import { isTouchDevice } from "../layout";

const Tooltip = (props: { text: string; children: JSX.Element }) => (
  <span class="group/tooltip relative inline-flex items-center">
    {props.children}
    <Show when={!isTouchDevice}>
      <span
        style={`transform: translate(-50%, 28px)`}
        class={`dark:shadow-dark-700 dark:bg-dark-300 pointer-events-none absolute left-[50%] z-20 hidden min-w-fit rounded border-[0.5px] border-neutral-300 bg-white p-1 text-center font-sans text-xs font-normal whitespace-nowrap text-neutral-900 shadow-md select-none group-hover/tooltip:inline first-letter:capitalize dark:border-neutral-600 dark:text-neutral-200`}
      >
        {props.text}
      </span>
    </Show>
  </span>
);

export default Tooltip;
