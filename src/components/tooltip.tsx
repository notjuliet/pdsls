import { JSX, Show } from "solid-js";

const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 1;

const Tooltip = (props: { text: string; children: JSX.Element }) => (
  <div class="group/tooltip relative flex items-center">
    {props.children}
    <Show when={!isTouchDevice}>
      <span
        style={`transform: translate(-50%, 28px)`}
        class={`left-50% border-0.5 dark:shadow-dark-900/80 pointer-events-none absolute z-10 hidden min-w-fit select-none whitespace-nowrap rounded border-neutral-300 bg-white p-1 text-center font-sans text-xs text-slate-900 shadow-md group-hover/tooltip:inline dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100`}
      >
        {props.text}
      </span>
    </Show>
  </div>
);

export default Tooltip;
