/**
 * Type contract for the design tokens defined in `tokens.js`.
 * `tokens.js` is checked against these types (`@satisfies`) and `tokens.d.ts` exposes them to
 * TypeScript consumers, so the plain JS file and its declarations cannot drift apart.
 */

/** Color schemes supported by the design system. */
export type ColorScheme = "light" | "dark";

/** Semantic color roles. Each one generates `<utility>-<role>` and `<utility>-<role>-dark`. */
export type SemanticColor =
  | "background"
  | "foreground"
  | "card"
  | "card-foreground"
  | "muted"
  | "muted-foreground"
  | "primary"
  | "primary-foreground"
  | "secondary"
  | "secondary-foreground"
  | "accent"
  | "accent-foreground"
  | "destructive"
  | "destructive-foreground"
  | "success"
  | "success-foreground"
  | "warning"
  | "warning-foreground"
  | "border"
  | "input"
  | "ring";

/**
 * A color with its light value (`DEFAULT`) and its dark-mode value (`dark`).
 * Tailwind flattens it to `bg-primary` and `bg-primary-dark`, so components write
 * `bg-primary dark:bg-primary-dark`.
 */
export type ThemedColor = Readonly<{ DEFAULT: string; dark: string }>;

export type ColorTokens = Readonly<Record<SemanticColor, ThemedColor>>;

export type RadiusToken = "none" | "sm" | "DEFAULT" | "md" | "lg" | "xl" | "2xl" | "full";

export type RadiusTokens = Readonly<Record<RadiusToken, string>>;

export type FontSizeToken = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

/** Tailwind `fontSize` tuple: `[fontSize, { lineHeight }]`. */
export type FontSizeValue = readonly [fontSize: string, options: Readonly<{ lineHeight: string }>];

export type FontSizeTokens = Readonly<Record<FontSizeToken, FontSizeValue>>;
