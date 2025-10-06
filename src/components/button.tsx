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
        "dark:hover:bg-dark-200 dark:shadow-dark-800 dark:active:bg-dark-100 box-border flex h-7 items-center gap-1 rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs shadow-xs select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800"
      }
      classList={props.classList}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
};
