import { onCleanup, onMount } from "solid-js";

import { CLOUD_HEIGHT, CLOUD_SCALE, CLOUD_WIDTH } from "../lib/cloud-shape";
import CloudShapeWorker from "../workers/cloud-shape.ts?worker";

const SECONDS_PER_TURN = 150;
/** How far below the horizon the planet's color deepens. */
const PLANET_SHADING = 85;
const SHADING_STEPS = 8;
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
    planet: [103, 144, 186, 0.91],
    planetEdge: [103, 144, 186, 0.91],
    cloud: "232, 241, 250",
    cloudAlpha: 0.85,
    // Dims the clouds behind the title, to keep it readable.
    behindTitle: "12, 26, 52",
    behindTitleAlpha: 0.62,
  },
  light: {
    // A daytime sky: a pale edge that fades outward into the page, brightest against the planet.
    atmosphere: [
      [0, "225, 240, 255", 0.9],
      [0.16, "160, 205, 245", 0.74],
      [0.5, "155, 200, 240", 0.36],
      [1, "170, 215, 248", 0],
    ],
    glowWidth: 46,
    // Deeper toward the horizon, like a real sphere, so the shape shows without flooding the page.
    planet: [100, 172, 236, 0.35],
    planetEdge: [77, 153, 231, 0.57],
    cloud: "255, 255, 255",
    cloudAlpha: 1,
    behindTitle: "255, 255, 255",
    behindTitleAlpha: 0,
  },
} as const;

/** Strips this wide follow the horizon's curve closely enough that no steps show. */
const STRIP_WIDTH = 2;
/** Enough of the clouds' start repeated past their end for a strip to always be drawn in one piece. */
const WRAP_OVERLAP = Math.ceil(STRIP_WIDTH * CLOUD_SCALE) + 1;

/** The cloud shape in one color, on a canvas of its own so it only has to be painted once. */
const paintClouds = (shape: Uint8ClampedArray, color: string, alpha: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = CLOUD_WIDTH + WRAP_OVERLAP;
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
  context.putImageData(image, CLOUD_WIDTH, 0);
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
      // Only outside the planet: a gradient keeps its first color all the way inside its inner circle.
      // Overlapping it by a pixel, or the background shows through a thin seam along the horizon.
      context.beginPath();
      context.rect(0, 0, width, height);
      context.arc(centerX, centerY, radius - 1 / (window.devicePixelRatio || 1), 0, Math.PI * 2);
      context.fill("evenodd");

      const spin = (time / 1000 / SECONDS_PER_TURN) * Math.PI * 2;

      context.save();
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.clip();
      const shading = context.createRadialGradient(
        centerX,
        centerY,
        radius - PLANET_SHADING,
        centerX,
        centerY,
        radius,
      );
      // Eased, since a straight blend shows a visible line where it starts.
      for (let step = 0; step <= SHADING_STEPS; step++) {
        const t = step / SHADING_STEPS;
        const eased = t * t * (3 - 2 * t);
        const [red, green, blue, alpha] = colors.planet.map(
          (from, i) => from + (colors.planetEdge[i] - from) * eased,
        );
        shading.addColorStop(t, `rgba(${red}, ${green}, ${blue}, ${alpha})`);
      }
      context.fillStyle = shading;
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
        context.drawImage(
          cloudLayer,
          source,
          0,
          sourceWidth,
          CLOUD_HEIGHT,
          x,
          top,
          STRIP_WIDTH,
          CLOUD_HEIGHT / CLOUD_SCALE,
        );
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
