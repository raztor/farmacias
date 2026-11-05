/**
 * Shared Tailwind CSS 3.4 preset (NativeWind 4 + design tokens) for Expo, Next.js
 * (react-native-web) and Storybook.
 *
 * ESM config (recommended), e.g. `tailwind.config.js` / `tailwind.config.ts`:
 *
 *   import { preset } from "@repo/tailwind-config/preset";
 *   export default { content: ["./src/**\/*.{ts,tsx}"], presets: [preset] };
 *
 * CommonJS config (e.g. Expo's `tailwind.config.js` without `"type": "module"`): Node 26 loads
 * this ES module through `require(esm)` and the `"module.exports"` export below makes `require`
 * return the preset itself, as NativeWind's own preset does:
 *
 *   module.exports = { content: [...], presets: [require("@repo/tailwind-config/preset")] };
 *
 * Dark mode uses the `class` strategy so apps can follow the system or switch theme manually
 * (`colorScheme.set()` from NativeWind toggles the `dark` class on the web). Apps may override
 * `darkMode` in their own config.
 */
import { createRequire } from "node:module";

import { colors, fontSize, radius } from "./src/tokens.js";

const requireCjs = createRequire(import.meta.url);

/**
 * NativeWind 4 ships its preset as CommonJS behind a directory entry point
 * (`nativewind/preset/package.json#main`), which native ESM cannot import, so it is required.
 * It is a function that picks the web or native preset from `NATIVEWIND_OS`.
 * @type {import("tailwindcss").Config["presets"]}
 */
const nativewindPresets = [requireCjs("nativewind/preset")];

/** @type {import("tailwindcss").Config} */
export const preset = {
  content: [],
  darkMode: "class",
  presets: nativewindPresets,
  theme: {
    extend: {
      colors,
      borderRadius: radius,
      fontSize,
    },
  },
};

export { preset as "module.exports" };
