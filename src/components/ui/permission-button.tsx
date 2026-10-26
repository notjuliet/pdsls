import { JSX } from "solid-js";

import { hasUserScope, type ScopeId } from "../../auth/scope-utils";
import { showPermissionPrompt } from "./permission-prompt";
import Tooltip from "./tooltip";

/** The square icon button style, shared with IconButton. */
export const iconButtonClass =
  "flex items-center rounded-md p-1.5 hover:bg-neutral-200 active:bg-neutral-300 disabled:opacity-40 dark:hover:bg-neutral-700 dark:active:bg-neutral-600";

interface PermissionButtonProps {
  scope: ScopeId;
  tooltip?: string;
  /** The accessible name, for buttons that only show an icon. */
  label?: string;
  class?: string;
  disabledClass?: string;
  onClick: (event: MouseEvent) => void;
  children: JSX.Element;
}

export const PermissionButton = (props: PermissionButtonProps) => {
  const hasPermission = () => hasUserScope(props.scope);

  const handleClick = (event: MouseEvent) => {
    if (hasPermission()) {
      props.onClick(event);
    } else {
      showPermissionPrompt(props.scope);
    }
  };

  const baseClass = props.class || iconButtonClass;
  const disabledClass = props.disabledClass || "flex items-center rounded-md p-1.5 opacity-40";

  const tooltip = () =>
    hasPermission() ? props.tooltip : `${props.tooltip ?? ""} (permission required)`.trimStart();

  const button = (
    <button
      type="button"
      aria-label={props.label}
      class={hasPermission() ? baseClass : disabledClass}
      onclick={handleClick}
    >
      {props.children}
    </button>
  );

  return props.tooltip ? <Tooltip text={tooltip()!}>{button}</Tooltip> : button;
};
