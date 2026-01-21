import { ComponentProps, createEffect, onCleanup, Show } from "solid-js";

export interface ModalProps extends Pick<ComponentProps<"svg">, "children"> {
  open?: boolean;
  onClose?: () => void;
  closeOnClick?: boolean;
  nonBlocking?: boolean;
  alignTop?: boolean;
  contentClass?: string;
}

export const Modal = (props: ModalProps) => {
  return (
    <Show when={props.open}>
      <div
        data-modal
        class="fixed inset-0 z-50 flex h-full max-h-none w-full max-w-none justify-center bg-transparent text-neutral-900 dark:text-neutral-200"
        classList={{
          "pointer-events-none": props.nonBlocking,
          "items-start pt-18": props.alignTop,
          "items-center": !props.alignTop,
        }}
        ref={(node) => {
          const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
              const modals = document.querySelectorAll("[data-modal]");
              const lastModal = modals[modals.length - 1];
              if (lastModal === node) {
                e.preventDefault();
                e.stopPropagation();
                if (props.onClose) props.onClose();
              }
            }
          };

          createEffect(() => {
            if (!props.nonBlocking) document.body.style.overflow = "hidden";
            else document.body.style.overflow = "auto";
          });

          document.addEventListener("keydown", handleEscape);

          onCleanup(() => {
            document.body.style.overflow = "auto";
            document.removeEventListener("keydown", handleEscape);
          });
        }}
        onClick={(ev) => {
          if (
            (props.closeOnClick ?? true) &&
            ev.target === ev.currentTarget &&
            !props.nonBlocking
          ) {
            if (props.onClose) props.onClose();
          }
        }}
      >
        <div
          class={`transition-all starting:scale-95 starting:opacity-0 ${props.contentClass ?? ""}`}
        >
          {props.children}
        </div>
      </div>
    </Show>
  );
};
