import { Show } from "solid-js";

import type { ScopeId } from "../../auth/scope-utils";
import { iconButtonClass, PermissionButton } from "./permission-button.jsx";
import Tooltip from "./tooltip.jsx";

interface IconButtonProps {
  /** An iconify class, e.g. `lucide--trash-2`. */
  icon: string;
  /** The accessible name, also shown as a tooltip unless `tooltip` is false. */
  label: string;
  onClick: (event: MouseEvent) => void;
  disabled?: boolean;
  /** Extra classes for the icon, e.g. its color. */
  iconClass?: string;
  tooltip?: boolean;
  /** An OAuth permission the action needs; without it the button asks for it instead. */
  scope?: ScopeId;
}

export const IconButton = (props: IconButtonProps) => {
  const icon = () => <span class={`iconify ${props.icon} ${props.iconClass ?? ""}`} />;

  return (
    <Show
      when={props.scope}
      fallback={(() => {
        const button = (
          <button
            type="button"
            aria-label={props.label}
            disabled={props.disabled}
            onClick={(event) => props.onClick(event)}
            class={iconButtonClass}
          >
            {icon()}
          </button>
        );
        return props.tooltip === false ? button : <Tooltip text={props.label}>{button}</Tooltip>;
      })()}
    >
      {(scope) => (
        <PermissionButton
          scope={scope()}
          tooltip={props.tooltip === false ? undefined : props.label}
          label={props.label}
          onClick={(event) => props.onClick(event)}
        >
          {icon()}
        </PermissionButton>
      )}
    </Show>
  );
};
