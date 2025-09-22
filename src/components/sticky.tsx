import { createSignal, JSX, onCleanup, onMount } from "solid-js";

export const StickyOverlay = (props: { children?: JSX.Element }) => {
  const [filterStuck, setFilterStuck] = createSignal(false);

  return (
    <>
      <div
        ref={(trigger) => {
          onMount(() => {
            const observer = new IntersectionObserver(
              ([entry]) => setFilterStuck(!entry.isIntersecting),
              {
                rootMargin: "-8px 0px 0px 0px",
                threshold: 0,
              },
            );

            observer.observe(trigger);

            onCleanup(() => {
              observer.unobserve(trigger);
              observer.disconnect();
            });
          });
        }}
        class="pointer-events-none h-0"
        aria-hidden="true"
      />

      <div
        class="sticky top-2 z-10 flex w-full flex-col items-center justify-center gap-2 rounded-lg p-3 transition-colors"
        classList={{
          "bg-neutral-50 dark:bg-dark-300 border-[0.5px] border-neutral-300 dark:border-neutral-700 shadow-md":
            filterStuck(),
          "bg-transparent border-transparent shadow-none": !filterStuck(),
        }}
      >
        {props.children}
      </div>
    </>
  );
};
