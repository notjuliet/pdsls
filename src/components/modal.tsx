import { ComponentProps, onCleanup, onMount, Show } from "solid-js";

export interface ModalProps extends Pick<ComponentProps<"svg">, "children"> {
  open?: boolean;
  onClose?: () => void;
}

export const Modal = (props: ModalProps) => {
  return (
    <Show when={props.open}>
      <dialog
        ref={(node) => {
          onMount(() => {
            document.body.style.overflow = "hidden";
            node.showModal();
          });
          onCleanup(() => node.close());
        }}
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) {
            if (props.onClose) props.onClose();
          }
        }}
        onClose={() => {
          document.body.style.overflow = "auto";
          if (props.onClose) props.onClose();
        }}
        class="h-full max-h-none w-full max-w-none bg-transparent backdrop:bg-transparent"
      >
        {props.children}
      </dialog>
    </Show>
  );
};
