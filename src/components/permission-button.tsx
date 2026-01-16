import { JSX } from "solid-js";
import { hasUserScope } from "../auth/scope-utils";
import { showPermissionPrompt } from "./permission-prompt";
import Tooltip from "./tooltip";

export interface PermissionButtonProps {
  scope: "create" | "update" | "delete" | "blob";
  tooltip: string;
  class?: string;
  disabledClass?: string;
  onClick: () => void;
  children: JSX.Element;
}

export const PermissionButton = (props: PermissionButtonProps) => {
  const hasPermission = () => hasUserScope(props.scope);

  const handleClick = () => {
    if (hasPermission()) {
      props.onClick();
    } else {
      showPermissionPrompt(props.scope);
    }
  };

  const baseClass =
    props.class ||
    "flex items-center rounded-sm p-1.5 hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-neutral-700 dark:active:bg-neutral-600";
  const disabledClass = props.disabledClass || "flex items-center rounded-sm p-1.5 opacity-40";

  return (
    <Tooltip text={hasPermission() ? props.tooltip : `${props.tooltip} (permission required)`}>
      <button class={hasPermission() ? baseClass : disabledClass} onclick={handleClick}>
        {props.children}
      </button>
    </Tooltip>
  );
};
