import { JSX, Show } from "solid-js";

const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 1;

const Tooltip = (props: { text: string; children: JSX.Element }) => {
  const width = props.text.length;
  return (
    <div class="group/tooltip relative flex items-center font-sans">
      {props.children}
      <Show when={!isTouchDevice}>
        <span
          style={`transform: translate(-50%, 2rem)`}
          class={`left-50% pointer-events-none absolute z-10 hidden select-none whitespace-nowrap text-slate-900 dark:bg-neutral-800 dark:text-slate-100 min-w-[${width.toString()}ch] rounded border border-neutral-500 bg-white p-1 text-center text-xs group-hover/tooltip:inline`}
        >
          {props.text}
        </span>
      </Show>
    </div>
  );
};

export default Tooltip;
