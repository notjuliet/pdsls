import { type Accessor, onCleanup, onMount } from "solid-js";

/**
 * Invisible marker placed at the end of a paginated list. Calls `onLoadMore` when the
 * user scrolls (or attempts to scroll) while the marker is within `distance` px of the
 * viewport bottom.
 *
 * Loading is driven by scroll intent rather than "keep fetching while in range": with
 * small page sizes (e.g. `?limit=1`) the latter cascades through the whole collection
 * before the user has scrolled at all. The list's own button remains the explicit
 * fallback, e.g. when the fetched page is too short to be scrollable.
 */
export const LoadMoreSentinel = (props: {
  /** Whether another page is available to fetch. */
  hasMore: Accessor<boolean>;
  /** Whether a request is already in flight. */
  loading: Accessor<boolean>;
  onLoadMore: () => void;
  /** How far ahead of the viewport bottom (in px) to start loading. */
  distance?: number;
}) => {
  let sentinel!: HTMLDivElement;
  let frame: number | undefined;
  let lastTouchY: number | undefined;
  const distance = () => props.distance ?? 600;

  const maybeLoad = () => {
    if (!props.hasMore() || props.loading() || !sentinel?.isConnected) return;
    // Measure fresh: a page appended earlier in this frame must already push the
    // marker out of range.
    if (sentinel.getBoundingClientRect().top > window.innerHeight + distance()) return;
    props.onLoadMore();
  };

  onMount(() => {
    const schedule = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        maybeLoad();
      });
    };

    // `wheel`/`touchmove` also cover continued scrolling at the end of the document,
    // where the scroll position cannot change and no `scroll` event fires.
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 0) schedule();
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (y === undefined) return;
      if (lastTouchY === undefined || y < lastTouchY) schedule();
      lastTouchY = y;
    };
    const resetTouch = () => (lastTouchY = undefined);

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", resetTouch, { passive: true });
    window.addEventListener("touchcancel", resetTouch, { passive: true });
    onCleanup(() => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", resetTouch);
      window.removeEventListener("touchcancel", resetTouch);
    });
  });

  return <div ref={sentinel} class="h-px w-full" aria-hidden="true" />;
};
