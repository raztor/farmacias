// @ts-check
/**
 * Design tokens of the design system.
 *
 * Plain JavaScript ES module on purpose: Tailwind's config loader, Metro/NativeWind, Next.js
 * and Vite load it as-is, without a TypeScript step. Types live in `tokens.types.ts`
 * (checked here through `@satisfies`) and are exposed to TS consumers by `tokens.d.ts`.
 *
 * Colors are static values (no CSS variables) so they behave the same on React Native and on
 * the web via react-native-web. Every semantic color has a light value (`DEFAULT`) and a dark
 * value (`dark`): use `bg-background dark:bg-background-dark`.
 *
 * Font sizes use `px` instead of `rem` because NativeWind resolves `rem` to 14px on native and
 * the browser to 16px; `px` keeps typography identical on every platform.
 */

/** @import { ColorTokens, FontSizeTokens, RadiusTokens } from "./tokens.types" */

export const colors = /** @satisfies {ColorTokens} */ ({
  background: { DEFAULT: "#ffffff", dark: "#09090b" },
  foreground: { DEFAULT: "#09090b", dark: "#fafafa" },
  card: { DEFAULT: "#ffffff", dark: "#18181b" },
  "card-foreground": { DEFAULT: "#09090b", dark: "#fafafa" },
  muted: { DEFAULT: "#f4f4f5", dark: "#27272a" },
  // Light value darkened (T-09): #71717a reached only 4.4:1 on `muted` (WCAG 1.4.3 needs 4.5:1).
  "muted-foreground": { DEFAULT: "#67676f", dark: "#a1a1aa" },
  primary: { DEFAULT: "#2563eb", dark: "#60a5fa" },
  "primary-foreground": { DEFAULT: "#ffffff", dark: "#172554" },
  secondary: { DEFAULT: "#f4f4f5", dark: "#27272a" },
  "secondary-foreground": { DEFAULT: "#18181b", dark: "#fafafa" },
  accent: { DEFAULT: "#eff6ff", dark: "#1e293b" },
  "accent-foreground": { DEFAULT: "#1e3a8a", dark: "#dbeafe" },
  destructive: { DEFAULT: "#dc2626", dark: "#f87171" },
  "destructive-foreground": { DEFAULT: "#ffffff", dark: "#450a0a" },
  success: { DEFAULT: "#15803d", dark: "#4ade80" },
  "success-foreground": { DEFAULT: "#ffffff", dark: "#052e16" },
  warning: { DEFAULT: "#b45309", dark: "#fbbf24" },
  "warning-foreground": { DEFAULT: "#ffffff", dark: "#451a03" },
  border: { DEFAULT: "#e4e4e7", dark: "#27272a" },
  // Form field borders need 3:1 against the surface (T-09, WCAG 1.4.11); zinc-300/700 had 1.5:1.
  input: { DEFAULT: "#8a8a93", dark: "#71717a" },
  ring: { DEFAULT: "#2563eb", dark: "#60a5fa" },
});

export const radius = /** @satisfies {RadiusTokens} */ ({
  none: "0px",
  sm: "4px",
  DEFAULT: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "24px",
  full: "9999px",
});

export const fontSize = /** @satisfies {FontSizeTokens} */ ({
  xs: ["12px", { lineHeight: "16px" }],
  sm: ["14px", { lineHeight: "20px" }],
  base: ["16px", { lineHeight: "24px" }],
  lg: ["18px", { lineHeight: "28px" }],
  xl: ["20px", { lineHeight: "28px" }],
  "2xl": ["24px", { lineHeight: "32px" }],
  "3xl": ["30px", { lineHeight: "36px" }],
  "4xl": ["36px", { lineHeight: "40px" }],
});
