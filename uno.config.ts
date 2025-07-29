import { defineConfig, presetIcons, presetWebFonts, presetWind4 } from "unocss";

export default defineConfig({
  presets: [
    presetIcons(),
    presetWind4(),
    presetWebFonts({
      provider: "bunny",
      fonts: {
        sans: "Inter:400,600,700",
        mono: "JetBrains Mono:400,700",
      },
    }),
  ],
});
