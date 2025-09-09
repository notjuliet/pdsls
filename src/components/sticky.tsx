import { createSignal, JSX, onCleanup, onMount } from "solid-js";

export const StickyOverlay = (props: { children?: JSX.Element }) => {
  const [filterStuck, setFilterStuck] = createSignal(false);

  return (
    <div
      ref={(node) => {
        onMount(() => {
          let ticking = false;
          const tick = () => {
            const topPx = parseFloat(getComputedStyle(node).top);
            const { top } = node.getBoundingClientRect();
            setFilterStuck(top <= topPx + 0.5);
            ticking = false;
          };

          const onScroll = () => {
            if (!ticking) {
              ticking = true;
              requestAnimationFrame(tick);
            }
          };

          window.addEventListener("scroll", onScroll, { passive: true });

          tick();

          onCleanup(() => {
            window.removeEventListener("scroll", onScroll);
          });
        });
      }}
      class="sticky top-2 z-10 flex flex-col items-center justify-center gap-2 rounded-lg p-3 transition-colors"
      classList={{
        "bg-neutral-50 dark:bg-dark-300 border-[0.5px] border-neutral-300 dark:border-neutral-700 shadow-md":
          filterStuck(),
        "bg-transparent border-transparent shadow-none": !filterStuck(),
      }}
    >
      {props.children}
    </div>
  );
};
