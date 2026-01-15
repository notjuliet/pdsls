import { A } from "@solidjs/router";
import { createSignal, JSX, onCleanup, Show } from "solid-js";
import { isTouchDevice } from "../../layout";

interface HoverCardProps {
  /** Link href - if provided, renders an A tag */
  href?: string;
  /** Link/trigger label text */
  label?: string;
  /** Open link in new tab */
  newTab?: boolean;
  /** Called when hover starts (for prefetching) */
  onHover?: () => void;
  /** Custom trigger element - if provided, overrides href/label */
  trigger?: JSX.Element;
  /** Additional classes for the wrapper span */
  class?: string;
  /** Additional classes for the preview container */
  previewClass?: string;
  /** Preview content */
  children: JSX.Element;
}

const HoverCard = (props: HoverCardProps) => {
  const [show, setShow] = createSignal(false);

  const [previewHeight, setPreviewHeight] = createSignal(0);
  let anchorRef!: HTMLSpanElement;
  let previewRef!: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;

  const setupResizeObserver = (el: HTMLDivElement) => {
    resizeObserver?.disconnect();
    previewRef = el;
    resizeObserver = new ResizeObserver(() => {
      if (previewRef) setPreviewHeight(previewRef.offsetHeight);
    });
    resizeObserver.observe(el);
  };

  onCleanup(() => {
    resizeObserver?.disconnect();
  });

  const isOverflowing = (previewHeight: number) =>
    anchorRef && anchorRef.offsetTop - window.scrollY + previewHeight + 32 > window.innerHeight;

  const handleMouseEnter = () => {
    props.onHover?.();
    setShow(true);
  };

  const handleMouseLeave = () => {
    setShow(false);
  };

  return (
    <span
      ref={anchorRef}
      class={`group/hover-card relative ${props.class || "inline"}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {props.trigger ?? (
        <A
          class="text-blue-500 hover:underline active:underline dark:text-blue-400"
          href={props.href!}
          target={props.newTab ? "_blank" : "_self"}
        >
          {props.label}
        </A>
      )}
      <Show when={show() && !isTouchDevice}>
        <div
          ref={setupResizeObserver}
          class={`dark:bg-dark-300 dark:shadow-dark-700 pointer-events-none absolute left-[50%] z-50 block -translate-x-1/2 overflow-hidden rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 shadow-md dark:border-neutral-700 ${props.previewClass || ""} ${isOverflowing(previewHeight()) ? "bottom-7" : "top-7"}`}
        >
          {props.children}
        </div>
      </Show>
    </span>
  );
};

export default HoverCard;
