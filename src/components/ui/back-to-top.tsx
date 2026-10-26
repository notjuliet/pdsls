import { createSignal, onCleanup, onMount } from "solid-js";

/** Fixed bars along the bottom of the page, which the button sits above. */
const BOTTOM_BARS = ".bottom-controls-fade, [data-bottom-bar]";
/** Space between the button and the window edge or a bottom bar. */
const OFFSET = 16;

/**
 * A floating button back to the top of the page, shown once you've scrolled a screen down. It
 * floats over the content, so it uses a raised surface rather than the bar buttons' colors.
 */
export const BackToTop = () => {
  const [visible, setVisible] = createSignal(false);
  const [bottom, setBottom] = createSignal(OFFSET);

  const update = () => {
    setVisible(window.scrollY > window.innerHeight);
    let barTop = window.innerHeight;
    for (const bar of document.querySelectorAll(BOTTOM_BARS)) {
      barTop = Math.min(barTop, bar.getBoundingClientRect().top);
    }
    setBottom(window.innerHeight - barTop + OFFSET);
  };

  onMount(() => {
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    onCleanup(() => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    });
  });

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible() ? 0 : -1}
      aria-hidden={!visible()}
      onClick={() => window.scrollTo(0, 0)}
      style={{ bottom: `${bottom()}px` }}
      class="dark:bg-dark-200 dark:hover:bg-dark-100 fixed right-4 z-20 flex size-7.5 items-center justify-center rounded-md border border-neutral-300 bg-neutral-50 text-neutral-700 shadow-sm transition-opacity hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-600 dark:text-neutral-200 dark:shadow-black/50 dark:active:bg-neutral-600"
      classList={{ "pointer-events-none opacity-0": !visible() }}
    >
      <span class="iconify lucide--arrow-up text-base" />
    </button>
  );
};
