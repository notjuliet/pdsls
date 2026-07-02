import { createContext, createEffect, createSignal, onCleanup, Show, useContext } from "solid-js";
import type { Accessor, JSX } from "solid-js";
import { Portal } from "solid-js/web";

import { canHover } from "../../layout";
import { getFloatingStyle, measureFloatingElement } from "./position";

interface HoverTriggerState {
  loading: Accessor<boolean>;
}

export type HoverTriggerRenderer = (state: HoverTriggerState) => JSX.Element;

/**
 * Lets a nested hover card suppress its ancestor's preview while the descendant
 * is being interacted with, so nested previews don't overlap. A card calls the
 * function on mouseenter and receives an unsubscribe to invoke on mouseleave.
 */
const HoverCardContext = createContext<() => () => void>();

export const HoverCardError = (props: { message?: string }) => (
  <div class="font-sans text-sm wrap-break-word text-red-500 dark:text-red-400">
    {props.message}
  </div>
);

interface HoverCardProps {
  /** Called when hover starts (for prefetching) */
  onHover?: () => void;
  /** Delay in ms before showing card and calling onHover (default: 0) */
  hoverDelay?: number;
  /** Element that opens the preview on hover */
  trigger: JSX.Element;
  /** Additional classes for the wrapper span */
  class?: string;
  /** Additional classes for the preview container */
  previewClass?: string;
  /** Whether the preview container should be visible once hover is active */
  showPreview?: boolean;
  /** Preview content */
  children: JSX.Element;
}

const HoverCard = (props: HoverCardProps) => {
  const [show, setShow] = createSignal(false);
  const [childActive, setChildActive] = createSignal(false);

  const active = () => show() && !childActive();

  const [previewSize, setPreviewSize] = createSignal({ width: 0, height: 0 });
  const [anchorRect, setAnchorRect] = createSignal<DOMRect | null>(null);
  let anchorRef!: HTMLSpanElement;
  let previewRef!: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;
  let hoverTimeout: number | null = null;
  let unsuppressParent: (() => void) | null = null;

  const parentSuppress = useContext(HoverCardContext);
  const suppressAncestor = () => {
    setChildActive(true);
    return () => setChildActive(false);
  };

  const updateAnchorRect = () => {
    if (anchorRef) setAnchorRect(anchorRef.getBoundingClientRect());
  };

  const setupResizeObserver = (el: HTMLDivElement) => {
    resizeObserver?.disconnect();
    previewRef = el;
    setPreviewSize(measureFloatingElement(el));
    resizeObserver = new ResizeObserver(() => {
      if (previewRef) setPreviewSize(measureFloatingElement(previewRef));
    });
    resizeObserver.observe(el);
  };

  createEffect(() => {
    if (!show()) return;

    window.addEventListener("scroll", updateAnchorRect, true);
    window.addEventListener("resize", updateAnchorRect);

    onCleanup(() => {
      window.removeEventListener("scroll", updateAnchorRect, true);
      window.removeEventListener("resize", updateAnchorRect);
    });
  });

  onCleanup(() => {
    resizeObserver?.disconnect();
    if (hoverTimeout !== null) {
      clearTimeout(hoverTimeout);
    }
    unsuppressParent?.();
    unsuppressParent = null;
  });

  const getPreviewStyle = () => {
    return getFloatingStyle(anchorRect(), previewSize(), {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  const handleMouseEnter = () => {
    const delay = props.hoverDelay ?? 0;
    updateAnchorRect();

    // Suppress any ancestor hover card while this one is (or will be) open, so
    // nested previews don't overlap. Done immediately, before the hover delay,
    // so the ancestor's own delayed preview never flashes underneath us.
    unsuppressParent = parentSuppress?.() ?? null;

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
    unsuppressParent?.();
    unsuppressParent = null;
  };

  return (
    <HoverCardContext.Provider value={suppressAncestor}>
      <span
        ref={anchorRef}
        class={`group/hover-card relative ${props.class || "inline"}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {props.trigger}
        <Show when={active() && canHover && (props.showPreview ?? true)}>
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
    </HoverCardContext.Provider>
  );
};

export default HoverCard;
