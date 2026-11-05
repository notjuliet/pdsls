/** Finer than the page's pixels, so the clouds stay sharp on high-density screens. */
export const CLOUD_SCALE = 1.5;
export const CLOUD_WIDTH = 1536;
export const CLOUD_HEIGHT = 255;
/** Smooth gradient noise that wraps sideways, without the blocky look of simpler noise. */
const makeNoise = (cells: number, rows: number) => {
  const angles = Float32Array.from({ length: cells * rows }, () => Math.random() * Math.PI * 2);
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const corner = (column: number, row: number, x: number, y: number) => {
    const angle = angles[(row % rows) * cells + (column % cells)];
    return Math.cos(angle) * x + Math.sin(angle) * y;
  };
  return (x: number, y: number) => {
    const left = Math.floor(x);
    const top = Math.floor(y);
    const dx = x - left;
    const dy = y - top;
    const tx = fade(dx);
    const upper = corner(left, top, dx, dy) * (1 - tx) + corner(left + 1, top, dx - 1, dy) * tx;
    const lower =
      corner(left, top + 1, dx, dy - 1) * (1 - tx) + corner(left + 1, top + 1, dx - 1, dy - 1) * tx;
    return upper * (1 - fade(dy)) + lower * fade(dy);
  };
};

/** Layers of noise, warped so they billow, shaped into soft patches of cloud. */
export const makeCloudShape = () => {
  const shape = new Uint8ClampedArray(CLOUD_WIDTH * CLOUD_HEIGHT);
  const rowsFor = (cells: number) => Math.ceil((cells * CLOUD_HEIGHT * 2) / CLOUD_WIDTH) + 2;
  const layers = [
    { cells: 12, weight: 0.62 },
    { cells: 24, weight: 0.3 },
    { cells: 48, weight: 0.16 },
    { cells: 96, weight: 0.09 },
    { cells: 192, weight: 0.05 },
  ].map((layer) => ({ ...layer, noise: makeNoise(layer.cells, rowsFor(layer.cells)) }));
  const warpCells = 8;
  const warp = makeNoise(warpCells, rowsFor(warpCells));
  for (let y = 0; y < CLOUD_HEIGHT; y++) {
    // Fades in below the horizon, keeping its curve clean.
    const belowHorizon = Math.min(1, y / (22 * CLOUD_SCALE));
    for (let x = 0; x < CLOUD_WIDTH; x++) {
      // Stretched sideways, the way clouds look near a horizon.
      const across = x / CLOUD_WIDTH;
      const down = (y / CLOUD_WIDTH) * 2;
      const shift = warp(across * warpCells, down * warpCells) * 0.035;
      let value = 0.5;
      for (const { cells, weight, noise } of layers) {
        value +=
          noise(((((across + shift) % 1) + 1) % 1) * cells, (down + shift) * cells + 1) * weight;
      }
      const amount = Math.min(1, Math.max(0, (value - 0.5) / 0.24));
      shape[y * CLOUD_WIDTH + x] = amount * amount * (3 - 2 * amount) * belowHorizon * 255;
    }
  }
  return shape;
};
