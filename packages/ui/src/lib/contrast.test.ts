import { colors, type ColorScheme, type SemanticColor } from "@repo/tailwind-config";
import { describe, expect, it } from "vitest";

/**
 * Contrast spot checks of the design tokens (T-09, RNF-01/RNF-02, WCAG 2.1 SC 1.4.3 and 1.4.11).
 * Every foreground/background pair that the components and apps actually draw is checked in the
 * light and dark schemes, so a token change that breaks legibility fails here before any
 * browser test runs. Report: docs/validation/accesibilidad.md.
 */

/** WCAG 2.x relative luminance of a `#rrggbb` color. */
function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) throw new Error(`Expected a #rrggbb color, got "${hex}"`);
  const [red, green, blue] = match.slice(1).map((part) => {
    const channel = Number.parseInt(part, 16) / 255;
    return channel <= 0.039_28 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

/** WCAG contrast ratio between two colors (1 to 21, order independent). */
function contrastRatio(first: string, second: string): number {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const tokenValue = (token: SemanticColor, scheme: ColorScheme): string =>
  scheme === "dark" ? colors[token].dark : colors[token].DEFAULT;

const ratioOf = (fg: SemanticColor, bg: SemanticColor, scheme: ColorScheme): number =>
  contrastRatio(tokenValue(fg, scheme), tokenValue(bg, scheme));

/** SC 1.4.3: normal-size text needs 4.5:1. */
const TEXT_MIN = 4.5;
/** SC 1.4.11: focus rings, form field borders and status borders need 3:1. */
const NON_TEXT_MIN = 3;

type Pair = readonly [foreground: SemanticColor, background: SemanticColor];

/** Text drawn on a surface (body text, muted hints, tone labels, buttons, badges, notices). */
const TEXT_PAIRS: readonly Pair[] = [
  ["foreground", "background"],
  ["foreground", "muted"],
  ["foreground", "accent"],
  ["card-foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "accent"],
  ["primary", "background"],
  ["primary", "card"],
  ["primary", "accent"],
  ["success", "background"],
  ["success", "card"],
  ["warning", "background"],
  ["warning", "card"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["destructive-foreground", "destructive"],
  ["background", "muted-foreground"],
];

/** UI components and graphical objects (focus ring, input borders, tone borders and icons). */
const NON_TEXT_PAIRS: readonly Pair[] = [
  ["ring", "background"],
  ["ring", "card"],
  ["ring", "accent"],
  ["input", "background"],
  ["input", "card"],
  ["primary", "background"],
  ["success", "background"],
  ["warning", "background"],
  ["destructive", "background"],
];

const SCHEMES: readonly ColorScheme[] = ["light", "dark"];

describe("contrastRatio (WCAG 2.x formula)", () => {
  it("returns 21 for black on white and 1 for identical colors", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#2563eb", "#2563eb")).toBe(1);
  });

  it("matches known reference values", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#949494", "#ffffff")).toBeCloseTo(3.03, 2);
  });

  it("rejects values that are not #rrggbb", () => {
    expect(() => contrastRatio("blue", "#ffffff")).toThrow(/#rrggbb/);
  });
});

describe.each(SCHEMES)("design tokens, %s scheme", (scheme) => {
  it.each(TEXT_PAIRS)(`text %s on %s reaches ${String(TEXT_MIN)}:1 (SC 1.4.3)`, (fg, bg) => {
    expect(ratioOf(fg, bg, scheme)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it.each(NON_TEXT_PAIRS)(
    `component %s on %s reaches ${String(NON_TEXT_MIN)}:1 (SC 1.4.11)`,
    (fg, bg) => {
      expect(ratioOf(fg, bg, scheme)).toBeGreaterThanOrEqual(NON_TEXT_MIN);
    },
  );
});
