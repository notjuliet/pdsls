import { copyFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmSrc = resolve(__dirname, "../node_modules/@takumi-rs/wasm/pkg/takumi_wasm_bg.wasm");

await build({
  entryPoints: ["src/worker.js"],
  bundle: true,
  outfile: "dist/_worker.js",
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["*.wasm", "@takumi-rs/core", "@takumi-rs/wasm/auto", "@takumi-rs/wasm/next"],
  minify: true,
});

copyFileSync(wasmSrc, "dist/takumi_wasm_bg.wasm");

console.log("Worker built successfully.");
