import { A } from "@solidjs/router";
import { createSignal, JSX, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
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
  /** Delay in ms before showing card and calling onHover (default: 0) */
  hoverDelay?: number;
  /** Custom trigger element - if provided, overrides href/label */
  trigger?: JSX.Element;
  /** Additional classes for the wrapper span */
  class?: string;
  /** Additional classes for the link/label */
  labelClass?: string;
  /** Additional classes for the preview container */
  previewClass?: string;
  /** Preview content */
  children: JSX.Element;
}

const HoverCard = (props: HoverCardProps) => {
  const [show, setShow] = createSignal(false);

  const [previewHeight, setPreviewHeight] = createSignal(0);
  const [anchorRect, setAnchorRect] = createSignal<DOMRect | null>(null);
  let anchorRef!: HTMLSpanElement;
  let previewRef!: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;
  let hoverTimeout: number | null = null;

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
    if (hoverTimeout !== null) {
      clearTimeout(hoverTimeout);
    }
  });

  const isOverflowing = (previewHeight: number) => {
    const rect = anchorRect();
    return rect && rect.top + previewHeight + 32 > window.innerHeight;
  };

  const getPreviewStyle = () => {
    const rect = anchorRect();
    if (!rect) return {};

    const left = rect.left + rect.width / 2;
    const overflowing = isOverflowing(previewHeight());
    const gap = 4;

    return {
      left: `${left}px`,
      top: overflowing ? `${rect.top - gap}px` : `${rect.bottom + gap}px`,
      transform: overflowing ? "translate(-50%, -100%)" : "translate(-50%, 0)",
    };
  };

  const handleMouseEnter = () => {
    const delay = props.hoverDelay ?? 0;
    setAnchorRect(anchorRef.getBoundingClientRect());

    if (delay > 0) {
      hoverTimeout = window.setTimeout(() => {
        props.onHover?.();
        setShow(true);
        hoverTimeout = null;
      }, delay);
    } else {
      props.onHover?.();
      setShow(true);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeout !== null) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
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
          class={`text-blue-500 hover:underline active:underline dark:text-blue-400 ${props.labelClass || ""}`}
          href={props.href!}
          target={props.newTab ? "_blank" : "_self"}
        >
          {props.label}
        </A>
      )}
      <Show when={show() && !isTouchDevice}>
        <Portal>
          <div
            ref={setupResizeObserver}
            style={getPreviewStyle()}
            class={`dark:bg-dark-300 dark:shadow-dark-700 pointer-events-none fixed z-50 block overflow-hidden rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 p-2 shadow-md dark:border-neutral-700 ${props.previewClass ?? "max-h-80 w-max max-w-sm font-mono text-xs whitespace-pre-wrap sm:max-h-112 lg:max-w-lg"}`}
          >
            {props.children}
          </div>
        </Portal>
      </Show>
    </span>
  );
};

export default HoverCard;
