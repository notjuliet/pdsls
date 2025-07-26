import { JSX, Show } from "solid-js";

const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 1;

const Tooltip = (props: { text: string; children: JSX.Element }) => {
  const width = (props.text.length - 1).toString();
  return (
    <div class="group/tooltip relative flex items-center">
      {props.children}
      <Show when={!isTouchDevice}>
        <span
          style={`transform: translate(-50%, 28px); min-width: ${width}ch`}
          class={`left-50% border-0.5 pointer-events-none absolute z-10 hidden select-none whitespace-nowrap rounded border-neutral-300 bg-zinc-100 p-1 text-center font-sans text-xs text-slate-900 shadow-md group-hover/tooltip:inline dark:border-neutral-600 dark:bg-neutral-800 dark:text-slate-100`}
        >
          {props.text}
        </span>
      </Show>
    </div>
  );
};

export default Tooltip;
