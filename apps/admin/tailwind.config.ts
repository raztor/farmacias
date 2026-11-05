import { preset } from "@repo/tailwind-config/preset";
import type { Config } from "tailwindcss";

/**
 * Tailwind CSS 3.4 + NativeWind 4 (web). The shared preset brings the design tokens and the
 * NativeWind web preset; `content` must include `@repo/ui` so the classes used by its React
 * Native components end up in the generated CSS.
 *
 * `important: "html"` scopes every utility under `html` (`html .p-6`). react-native-web injects
 * its own reset classes (`.css-view-*`) after this stylesheet with the same specificity; the
 * extra selector makes Tailwind win.
 */
const config = {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  presets: [preset],
  important: "html",
} satisfies Config;

export default config;
