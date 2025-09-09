import { ComponentProps, onCleanup, onMount, Show } from "solid-js";

export interface ModalProps extends Pick<ComponentProps<"svg">, "children"> {
  open?: boolean;
  onClose?: () => void;
  closeOnClick?: boolean;
}

export const Modal = (props: ModalProps) => {
  return (
    <Show when={props.open}>
      <dialog
        ref={(node) => {
          onMount(() => {
            document.body.style.overflow = "hidden";
            node.showModal();
            (document.activeElement as any).blur();
          });
          onCleanup(() => node.close());
        }}
        onClick={(ev) => {
          if ((props.closeOnClick ?? true) && ev.target === ev.currentTarget) {
            if (props.onClose) props.onClose();
          }
        }}
        onClose={() => {
          document.body.style.overflow = "auto";
          if (props.onClose) props.onClose();
        }}
        class="h-full max-h-none w-full max-w-none bg-transparent text-neutral-900 backdrop:bg-transparent dark:text-neutral-200"
      >
        {props.children}
      </dialog>
    </Show>
  );
};
