import { JSX } from "solid-js";

export interface ButtonProps {
  class?: string;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
  children?: JSX.Element;
}

export const Button = (props: ButtonProps) => {
  return (
    <button
      type="button"
      class={
        props.class ??
        "dark:hover:bg-dark-100 dark:bg-dark-300 dark:shadow-dark-800 dark:active:bg-dark-100 flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold shadow-sm hover:bg-neutral-50 active:bg-neutral-50"
      }
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
};
