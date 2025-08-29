import { JSX, Show } from "solid-js";

const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 1;

const Tooltip = (props: { text: string; children: JSX.Element }) => (
  <div class="group/tooltip relative flex items-center">
    {props.children}
    <Show when={!isTouchDevice}>
      <span
        style={`transform: translate(-50%, 28px)`}
        class={`dark:shadow-dark-900/80 pointer-events-none absolute left-[50%] z-10 hidden min-w-fit rounded border-[0.5px] border-neutral-300 bg-white p-1 text-center font-sans text-xs whitespace-nowrap text-neutral-900 shadow-md select-none group-hover/tooltip:inline dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200`}
      >
        {props.text}
      </span>
    </Show>
  </div>
);

export default Tooltip;
