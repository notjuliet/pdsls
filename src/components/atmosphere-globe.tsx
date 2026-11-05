import { onCleanup, onMount } from "solid-js";

import { CLOUD_HEIGHT, CLOUD_SCALE, CLOUD_WIDTH } from "../lib/cloud-shape";
import CloudShapeWorker from "../workers/cloud-shape.ts?worker";

const SECONDS_PER_TURN = 150;
/** How far the top of the horizon sits below the canvas's top edge, leaving room for the glow. */
const HORIZON_TOP = 72;
/** Allows for screens that refresh slightly under 60Hz, which would otherwise drop to 20fps. */
const FRAME_MS = 1000 / 30 - 2;

const COLORS = {
  dark: {
    // From the horizon outward: bright haze, deep blue, then fading into the dark.
    atmosphere: [
      [0, "170, 218, 255", 0.85],
      [0.16, "86, 150, 225", 0.62],
      [0.5, "28, 70, 150", 0.34],
      [1, "16, 34, 80", 0],
    ],
    glowWidth: 42,
    planet: "rgba(24, 58, 104, 0.42)",
    cloud: "232, 241, 250",
    cloudAlpha: 0.85,
    // Dims the clouds behind the title, to keep it readable.
    behindTitle: "12, 26, 52",
    behindTitleAlpha: 0.62,
  },
  light: {
    // A daytime sky: a saturated blue edge, since there's no dark sky for it to glow against.
    atmosphere: [
      [0, "58, 140, 225", 0.65],
      [0.18, "96, 170, 238", 0.58],
      [0.55, "130, 195, 245", 0.34],
      [1, "170, 215, 248", 0],
    ],
    // Wider than on dark, since a pale haze needs more room to show against a light page.
    glowWidth: 60,
    planet: "rgba(80, 160, 232, 0.55)",
    cloud: "255, 255, 255",
    cloudAlpha: 1,
    behindTitle: "255, 255, 255",
    behindTitleAlpha: 0,
  },
} as const;

/** Strips this wide follow the horizon's curve closely enough that no steps show. */
const STRIP_WIDTH = 2;

/** The cloud shape in one color, on a canvas of its own so it only has to be painted once. */
const paintClouds = (shape: Uint8ClampedArray, color: string, alpha: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = CLOUD_WIDTH;
  canvas.height = CLOUD_HEIGHT;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(CLOUD_WIDTH, CLOUD_HEIGHT);
  const [red, green, blue] = color.split(", ").map(Number);
  for (let i = 0; i < shape.length; i++) {
    image.data[i * 4] = red;
    image.data[i * 4 + 1] = green;
    image.data[i * 4 + 2] = blue;
    image.data[i * 4 + 3] = shape[i] * alpha;
  }
  context.putImageData(image, 0, 0);
  return canvas;
};

/** Kept between visits to the page, so the clouds only have to be generated once. */
let cloudShape: Uint8ClampedArray | undefined;

/** The curve of a slowly turning planet, with clouds below and the atmosphere glowing above. */
export const AtmosphereGlobe = (props: { class?: string }) => {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const context = canvas.getContext("2d");
    if (!context) return;
    const clouds: Partial<Record<"dark" | "light", HTMLCanvasElement>> = {};
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastDraw = -Infinity;

    const draw = (time: number) => {
      const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
      const colors = COLORS[theme];
      const radius = width * 1.6;
      const centerX = width / 2;
      const centerY = HORIZON_TOP + radius;
      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(
        centerX,
        centerY,
        radius,
        centerX,
        centerY,
        radius + colors.glowWidth,
      );
      for (const [stop, color, alpha] of colors.atmosphere) {
        glow.addColorStop(stop, `rgba(${color}, ${alpha})`);
      }
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const spin = (time / 1000 / SECONDS_PER_TURN) * Math.PI * 2;

      context.save();
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.clip();
      context.fillStyle = colors.planet;
      context.fillRect(0, 0, width, height);
      const cloudLayer =
        cloudShape && (clouds[theme] ??= paintClouds(cloudShape, colors.cloud, colors.cloudAlpha));
      // Drawn in thin strips that each follow the curve of the horizon.
      const scroll = spin * radius * 0.6 * CLOUD_SCALE;
      const sourceWidth = STRIP_WIDTH * CLOUD_SCALE;
      for (let x = 0; cloudLayer && x < width; x += STRIP_WIDTH) {
        const offset = x + STRIP_WIDTH / 2 - centerX;
        const top = centerY - Math.sqrt(radius * radius - offset * offset);
        const source = (x * CLOUD_SCALE + scroll) % CLOUD_WIDTH;
        const first = Math.min(sourceWidth, CLOUD_WIDTH - source);
        const firstWidth = first / CLOUD_SCALE;
        const stripHeight = CLOUD_HEIGHT / CLOUD_SCALE;
        context.drawImage(
          cloudLayer,
          source,
          0,
          first,
          CLOUD_HEIGHT,
          x,
          top,
          firstWidth,
          stripHeight,
        );
        if (first < sourceWidth) {
          context.drawImage(
            cloudLayer,
            0,
            0,
            sourceWidth - first,
            CLOUD_HEIGHT,
            x + firstWidth,
            top,
            STRIP_WIDTH - firstWidth,
            stripHeight,
          );
        }
      }
      if (colors.behindTitleAlpha) {
        const behindTitle = context.createLinearGradient(0, 0, width, 0);
        behindTitle.addColorStop(0, `rgba(${colors.behindTitle}, 0)`);
        behindTitle.addColorStop(0.25, `rgba(${colors.behindTitle}, ${colors.behindTitleAlpha})`);
        behindTitle.addColorStop(0.75, `rgba(${colors.behindTitle}, ${colors.behindTitleAlpha})`);
        behindTitle.addColorStop(1, `rgba(${colors.behindTitle}, 0)`);
        context.fillStyle = behindTitle;
        context.fillRect(0, 0, width, height);
      }
      context.restore();
    };

    const stillOnly = window.matchMedia("(prefers-reduced-motion: reduce)");
    const loop = (time: number) => {
      // The first frame can arrive before the canvas has been measured.
      if (width && time - lastDraw >= FRAME_MS) {
        lastDraw = time;
        draw(time);
      }
      if (!stillOnly.matches) frame = requestAnimationFrame(loop);
    };

    const resize = new ResizeObserver(() => {
      const scale = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * scale;
      canvas.height = height * scale;
      context.scale(scale, scale);
      if (stillOnly.matches) draw(0);
    });
    resize.observe(canvas);
    frame = requestAnimationFrame(loop);

    // Generated off the main thread, as it's slow enough to freeze the page.
    let worker: Worker | undefined;
    if (!cloudShape) {
      worker = new CloudShapeWorker();
      worker.onmessage = (event: MessageEvent<Uint8ClampedArray>) => {
        cloudShape = event.data;
        worker?.terminate();
        if (stillOnly.matches && width) draw(0);
      };
    }

    onCleanup(() => {
      worker?.terminate();
      cancelAnimationFrame(frame);
      resize.disconnect();
    });
  });

  return <canvas ref={canvas} aria-hidden="true" class={props.class} />;
};
