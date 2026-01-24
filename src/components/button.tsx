import { JSX } from "solid-js";

export interface ButtonProps {
  type?: "button" | "submit" | "reset" | "menu" | undefined;
  disabled?: boolean;
  class?: string;
  classList?: Record<string, boolean | undefined>;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
  ontouchstart?: (e: TouchEvent) => void;
  children?: JSX.Element;
}

export const Button = (props: ButtonProps) => {
  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled ?? false}
      class={
        props.class ??
        "dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 flex items-center gap-1 rounded-md border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 transition-colors select-none hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300"
      }
      classList={props.classList}
      onClick={props.onClick}
      ontouchstart={props.ontouchstart}
    >
      {props.children}
    </button>
  );
};
