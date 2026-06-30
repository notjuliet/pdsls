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
}

export const measureFloatingElement = (element: HTMLElement): FloatingSize => ({
  width: element.offsetWidth,
  height: element.scrollHeight,
});

export const getFloatingStyle = (
  anchorRect: DOMRect | null,
  floatingSize: FloatingSize,
  viewport: ViewportSize,
  options: FloatingPositionOptions = {},
): JSX.CSSProperties => {
  if (!anchorRect) return {};

  const gap = options.gap ?? 4;
  const padding = options.padding ?? 8;
  const minHeight = options.minHeight ?? 80;

  const maxFloatingWidth = Math.max(0, viewport.width - padding * 2);
  const effectiveWidth = Math.min(floatingSize.width, maxFloatingWidth);
  const halfWidth = effectiveWidth / 2;
  const centerX = anchorRect.left + anchorRect.width / 2;
  const left = effectiveWidth
    ? Math.min(Math.max(centerX, padding + halfWidth), viewport.width - padding - halfWidth)
    : centerX;

  const belowTop = anchorRect.bottom + gap;
  const belowSpace = Math.max(0, viewport.height - padding - belowTop);
  const aboveSpace = Math.max(0, anchorRect.top - gap - padding);
  const viewportMaxHeight = Math.max(minHeight, viewport.height - padding * 2);
  const preferredHeight = Math.min(floatingSize.height, viewportMaxHeight);
  const placeBelow =
    !floatingSize.height || belowSpace >= preferredHeight || belowSpace >= aboveSpace;
  const availableSpace = placeBelow ? belowSpace : aboveSpace;
  const availableHeight = Math.max(minHeight, Math.min(viewportMaxHeight, availableSpace));
  const visibleHeight = Math.min(floatingSize.height || availableHeight, availableHeight);
  const top = placeBelow ? belowTop : Math.max(padding, anchorRect.top - gap - visibleHeight);

  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: "translateX(-50%)",
    "max-height": `${availableHeight}px`,
  };
};
