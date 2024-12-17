import { defineConfig, presetUno } from "unocss";

export default defineConfig({
  presets: [presetUno()],
  rules: [["list-dash", { "list-style-type": "'- '" }]],
});
