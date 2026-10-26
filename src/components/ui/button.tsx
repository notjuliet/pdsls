import { JSX } from "solid-js";

interface ButtonProps {
  type?: "button" | "submit" | "reset" | "menu" | undefined;
  /** "primary" for the main action of a form or dialog, "danger" for destructive ones. */
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
  class?: string;
  classList?: Record<string, boolean | undefined>;
  onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
  ontouchstart?: (e: TouchEvent) => void;
  children?: JSX.Element;
}

const baseClass =
  "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors select-none";

const variantClasses = {
  default:
    "dark:bg-dark-300 dark:hover:bg-dark-200 dark:active:bg-dark-100 border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-700 dark:text-neutral-300",
  primary:
    "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500 dark:active:bg-blue-400",
  danger: "bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-60",
};

export const Button = (props: ButtonProps) => {
  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled ?? false}
      class={props.class ?? `${baseClass} ${variantClasses[props.variant ?? "default"]}`}
      classList={props.classList}
      onClick={props.onClick}
      ontouchstart={props.ontouchstart}
    >
      {props.children}
    </button>
  );
};
