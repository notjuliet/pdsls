import { createSignal, onCleanup, onMount } from "solid-js";

/** Fixed bars along the bottom of the page, which the button sits above. */
const BOTTOM_BARS = ".bottom-controls-fade, [data-bottom-bar]";
/** Space between the button and a bottom bar, the window, or the content beside it. */
const OFFSET = 16;
/** The button's width, `size-7.5`. */
const BUTTON_SIZE = 30;

/**
 * A floating button back to the top of the page, shown once you've scrolled a screen down. It
 * floats over the content, so it uses a raised surface rather than the bar buttons' colors.
 */
export const BackToTop = () => {
  const [visible, setVisible] = createSignal(false);
  const [bottom, setBottom] = createSignal(OFFSET);
  const [right, setRight] = createSignal(OFFSET);

  const update = () => {
    setVisible(window.scrollY > window.innerHeight);
    let barTop = window.innerHeight;
    for (const bar of document.querySelectorAll(BOTTOM_BARS)) {
      barTop = Math.min(barTop, bar.getBoundingClientRect().top);
    }
    setBottom(window.innerHeight - barTop + OFFSET);

    // Just outside the content, beside the list, when the window has room; otherwise inside its
    // right edge, lined up with the bottom bars' buttons, so it covers as little as possible.
    const main = document.getElementById("main");
    if (main) {
      const contentRight =
        main.getBoundingClientRect().right - parseFloat(getComputedStyle(main).paddingRight);
      const margin = document.documentElement.clientWidth - contentRight;
      setRight(margin >= BUTTON_SIZE + 2 * OFFSET ? margin - BUTTON_SIZE - OFFSET : margin);
    }
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
      style={{ bottom: `${bottom()}px`, right: `${right()}px` }}
      class="dark:bg-dark-200 dark:hover:bg-dark-100 fixed z-20 flex size-7.5 items-center justify-center rounded-md border border-neutral-300 bg-neutral-50 text-neutral-700 shadow-sm transition-opacity hover:bg-neutral-100 active:bg-neutral-200 dark:border-neutral-600 dark:text-neutral-200 dark:shadow-black/50 dark:active:bg-neutral-600"
      classList={{ "pointer-events-none opacity-0": !visible() }}
    >
      <span class="iconify lucide--arrow-up text-base" />
    </button>
  );
};
