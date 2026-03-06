import { build } from "esbuild";
import { copyFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmSrc = resolve(__dirname, "../node_modules/@takumi-rs/wasm/pkg/takumi_wasm_bg.wasm");

await build({
  entryPoints: ["src/worker.js"],
  bundle: true,
  outfile: "dist/_worker.js",
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["*.wasm"],
  minify: true,
});

copyFileSync(wasmSrc, "dist/takumi_wasm_bg.wasm");

console.log("Worker built successfully.");
