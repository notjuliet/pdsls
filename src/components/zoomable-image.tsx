import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";

export const ZoomableImage = (props: { src: string | undefined; class?: string }) => {
  const [expanded, setExpanded] = createSignal(false);
  const [closing, setClosing] = createSignal(false);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setExpanded(false);
      setClosing(false);
    }, 200);
  };

  createEffect(() => {
    if (!expanded()) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    onCleanup(() => window.removeEventListener("keydown", handler));
  });

  return (
    <>
      <img
        class={`cursor-zoom-in object-contain ${props.class ?? ""}`}
        src={props.src}
        onclick={() => setExpanded(true)}
      />
      <Show when={expanded()}>
        <Portal>
          <div
            class="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 transition-opacity duration-200 starting:opacity-0"
            classList={{ "opacity-0": closing() }}
            onclick={close}
          >
            <img
              class="max-h-screen max-w-screen object-contain transition-all duration-200 starting:scale-95 starting:opacity-0"
              classList={{ "scale-95 opacity-0": closing() }}
              src={props.src}
            />
          </div>
        </Portal>
      </Show>
    </>
  );
};
