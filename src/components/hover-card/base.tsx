import { createContext, createEffect, createSignal, onCleanup, Show, useContext } from "solid-js";
import type { Accessor, JSX } from "solid-js";
import { Portal } from "solid-js/web";

import { canHover } from "../../layout";
import { getFloatingPosition, measureFloatingElement, type FloatingPlacement } from "./position";

interface HoverTriggerState {
  loading: Accessor<boolean>;
}

export type HoverTriggerRenderer = (state: HoverTriggerState) => JSX.Element;

interface HoverCardGroup {
  active: (() => void) | null;
}

interface HoverCardContextValue {
  group: HoverCardGroup;
  suppress?: () => () => void;
}

const rootHoverCardGroup: HoverCardGroup = { active: null };

/**
 * Lets hover cards nested in trigger content suppress an ancestor's preview.
 * Portaled preview content sits outside this provider so links inside an open
 * preview can be hovered without unmounting the preview that contains them.
 */
const HoverCardContext = createContext<HoverCardContextValue>({ group: rootHoverCardGroup });

export const HoverCardError = (props: { message?: string }) => (
  <div class="font-sans text-sm wrap-break-word text-red-500 dark:text-red-400">
    {props.message}
  </div>
);

const HIDE_DELAY_MS = 150;

interface HoverCardProps {
  /** Called when hover starts (for prefetching) */
  onHover?: () => void;
  /** Delay in ms before showing card and calling onHover (default: 0) */
  hoverDelay?: number;
  /** Element that opens the preview on hover */
  trigger: JSX.Element;
  /** Additional classes for the wrapper span */
  class?: string;
  /** Additional classes for the wrapper span while the preview is visible */
  activeClass?: string;
  /** Additional classes for the preview container */
  previewClass?: string;
  /** Preview placement preference (default: auto) */
  previewPlacement?: "auto" | "side";
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
  const [lockedPlacement, setLockedPlacement] = createSignal<FloatingPlacement | null>(null);
  let anchorRef!: HTMLSpanElement;
  let previewRef!: HTMLDivElement;
  let resizeObserver: ResizeObserver | null = null;
  let hoverTimeout: number | null = null;
  let hideTimeout: number | null = null;
  let unsuppressParent: (() => void) | null = null;

  const parentContext = useContext(HoverCardContext);
  const triggerDescendantGroup: HoverCardGroup = { active: null };
  const previewDescendantGroup: HoverCardGroup = { active: null };

  const suppressAncestor = () => {
    setChildActive(true);
    return () => setChildActive(false);
  };

  const clearHoverTimeout = () => {
    if (hoverTimeout === null) return;
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  };

  const clearHideTimeout = () => {
    if (hideTimeout === null) return;
    clearTimeout(hideTimeout);
    hideTimeout = null;
  };

  const releaseParent = () => {
    unsuppressParent?.();
    unsuppressParent = null;
  };

  const suppressParent = () => {
    if (unsuppressParent) return;
    unsuppressParent = parentContext.suppress?.() ?? null;
  };

  const releaseGroup = () => {
    if (parentContext.group.active !== hidePreview) return;
    parentContext.group.active = null;
  };

  const claimGroup = () => {
    if (parentContext.group.active === hidePreview) return;
    parentContext.group.active?.();
    parentContext.group.active = hidePreview;
  };

  const showPreview = () => {
    claimGroup();
    props.onHover?.();
    setShow(true);
  };

  const hidePreview = () => {
    clearHoverTimeout();
    clearHideTimeout();
    setShow(false);
    setLockedPlacement(null);
    releaseGroup();
    releaseParent();
  };

  const scheduleHide = () => {
    // The preview is portaled into <body>, separate from the trigger span. A
    // short delay gives the cursor time to cross between the two surfaces.
    clearHoverTimeout();
    clearHideTimeout();
    hideTimeout = window.setTimeout(hidePreview, HIDE_DELAY_MS);
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
    clearHoverTimeout();
    clearHideTimeout();
    releaseGroup();
    releaseParent();
  });

  const getViewportSize = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  createEffect(() => {
    if (!previewVisible() || lockedPlacement()) return;

    const size = previewSize();
    if (!anchorRect() || !size.height) return;

    const position = getFloatingPosition(anchorRect(), size, getViewportSize(), {
      placement: props.previewPlacement,
    });

    if (position.placement) setLockedPlacement(position.placement);
  });

  const getPreviewStyle = () => {
    return getFloatingPosition(anchorRect(), previewSize(), getViewportSize(), {
      placement: props.previewPlacement,
      lockedPlacement: lockedPlacement() ?? undefined,
    }).style;
  };

  const handleMouseEnter = () => {
    const delay = props.hoverDelay ?? 0;
    updateAnchorRect();
    clearHoverTimeout();
    clearHideTimeout();

    // Suppress any ancestor hover card while this one is (or will be) open, so
    // nested previews don't overlap. Done immediately, before the hover delay,
    // so the ancestor's own delayed preview never flashes underneath us.
    suppressParent();
    claimGroup();

    if (delay > 0) {
      hoverTimeout = window.setTimeout(() => {
        showPreview();
        hoverTimeout = null;
      }, delay);
    } else {
      showPreview();
    }
  };

  const previewVisible = () => active() && canHover && (props.showPreview ?? true);

  return (
    <>
      <HoverCardContext.Provider
        value={{ group: triggerDescendantGroup, suppress: suppressAncestor }}
      >
        <span
          ref={anchorRef}
          class={`group/hover-card relative ${props.class || "inline"} ${previewVisible() ? (props.activeClass ?? "") : ""}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={scheduleHide}
        >
          {props.trigger}
        </span>
      </HoverCardContext.Provider>
      <Show when={previewVisible()}>
        <Portal>
          <div
            style={getPreviewStyle()}
            onMouseEnter={clearHideTimeout}
            onMouseLeave={scheduleHide}
            class={`dark:bg-dark-300 dark:shadow-dark-700 pointer-events-auto fixed z-50 block overflow-hidden rounded-lg border-[0.5px] border-neutral-300 bg-neutral-50 shadow-md dark:border-neutral-700 ${props.previewClass ?? "max-h-80 w-max max-w-sm font-mono text-xs whitespace-pre-wrap sm:max-h-112 lg:max-w-lg"}`}
          >
            <HoverCardContext.Provider value={{ group: previewDescendantGroup }}>
              <div
                ref={setupResizeObserver}
                class="max-h-[inherit] overflow-y-auto overscroll-contain bg-inherit p-2"
              >
                {props.children}
              </div>
            </HoverCardContext.Provider>
          </div>
        </Portal>
      </Show>
    </>
  );
};

export default HoverCard;
