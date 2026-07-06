import type { JSX } from "solid-js";

interface FloatingSize {
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface FloatingPositionOptions {
  gap?: number;
  padding?: number;
  minHeight?: number;
  placement?: "auto" | "side";
  lockedPlacement?: FloatingPlacement;
  sideBreakpoint?: number;
}

export type FloatingPlacement = "above" | "below" | "left" | "right";

interface FloatingPosition {
  style: JSX.CSSProperties;
  placement: FloatingPlacement | null;
}

const SIDE_PLACEMENT_BREAKPOINT = 1280;

export const measureFloatingElement = (element: HTMLElement): FloatingSize => ({
  width: element.offsetWidth,
  height: element.scrollHeight,
});

export const getFloatingPosition = (
  anchorRect: DOMRect | null,
  floatingSize: FloatingSize,
  viewport: ViewportSize,
  options: FloatingPositionOptions = {},
): FloatingPosition => {
  if (!anchorRect) return { style: {}, placement: null };

  const gap = options.gap ?? 4;
  const padding = options.padding ?? 8;
  const minHeight = options.minHeight ?? 80;

  const maxFloatingWidth = Math.max(0, viewport.width - padding * 2);
  const effectiveWidth = Math.min(floatingSize.width, maxFloatingWidth);
  const viewportMaxHeight = Math.max(minHeight, viewport.height - padding * 2);
  const preferredHeight = Math.min(floatingSize.height, viewportMaxHeight);

  const lockedVertical = options.lockedPlacement === "above" || options.lockedPlacement === "below";

  if (
    options.placement === "side" &&
    !lockedVertical &&
    effectiveWidth &&
    viewport.width >= (options.sideBreakpoint ?? SIDE_PLACEMENT_BREAKPOINT)
  ) {
    const rightSpace = Math.max(0, viewport.width - padding - anchorRect.right - gap);
    const leftSpace = Math.max(0, anchorRect.left - gap - padding);
    const placeRight =
      options.lockedPlacement === "right"
        ? true
        : options.lockedPlacement === "left"
          ? false
          : rightSpace >= leftSpace;
    const availableWidth = placeRight ? rightSpace : leftSpace;

    if (availableWidth > 0) {
      const availableHeight = viewportMaxHeight;
      const visibleHeight = Math.min(floatingSize.height || availableHeight, availableHeight);
      const anchorCenterY = anchorRect.top + anchorRect.height / 2;
      const top = Math.min(
        Math.max(anchorCenterY - visibleHeight / 2, padding),
        viewport.height - padding - visibleHeight,
      );

      return {
        placement: placeRight ? "right" : "left",
        style: {
          left: `${placeRight ? anchorRect.right + gap : anchorRect.left - gap}px`,
          top: `${top}px`,
          ...(placeRight ? {} : { transform: "translateX(-100%)" }),
          "max-width": `${availableWidth}px`,
          "max-height": `${availableHeight}px`,
        },
      };
    }
  }

  const halfWidth = effectiveWidth / 2;
  const centerX = anchorRect.left + anchorRect.width / 2;
  const left = effectiveWidth
    ? Math.min(Math.max(centerX, padding + halfWidth), viewport.width - padding - halfWidth)
    : centerX;

  const belowTop = anchorRect.bottom + gap;
  const belowSpace = Math.max(0, viewport.height - padding - belowTop);
  const aboveSpace = Math.max(0, anchorRect.top - gap - padding);
  const placeBelow =
    options.lockedPlacement === "below"
      ? true
      : options.lockedPlacement === "above"
        ? false
        : !floatingSize.height || belowSpace >= preferredHeight || belowSpace >= aboveSpace;
  const availableSpace = placeBelow ? belowSpace : aboveSpace;
  const availableHeight = Math.max(minHeight, Math.min(viewportMaxHeight, availableSpace));
  const visibleHeight = Math.min(floatingSize.height || availableHeight, availableHeight);
  const top = placeBelow ? belowTop : Math.max(padding, anchorRect.top - gap - visibleHeight);

  return {
    placement: placeBelow ? "below" : "above",
    style: {
      left: `${left}px`,
      top: `${top}px`,
      transform: "translateX(-50%)",
      "max-height": `${availableHeight}px`,
    },
  };
};
