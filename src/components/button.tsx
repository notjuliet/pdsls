import { JSX } from "solid-js";

export interface ButtonProps {
  class?: string;
  classList?: Record<string, boolean | undefined>;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
  children?: JSX.Element;
}

export const Button = (props: ButtonProps) => {
  return (
    <button
      type="button"
      class={
        props.class ??
        "dark:hover:bg-dark-100 dark:bg-dark-300 dark:shadow-dark-800 dark:active:bg-dark-100 flex items-center gap-1 rounded-lg border-[0.5px] border-neutral-300 bg-white px-2 py-1.5 text-xs font-semibold shadow-md hover:bg-neutral-50 active:bg-neutral-50 dark:border-neutral-700"
      }
      classList={props.classList}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
};
