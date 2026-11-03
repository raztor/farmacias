import { colorScheme } from "nativewind";
import { useLayoutEffect, type ReactNode } from "react";

export const COLOR_SCHEMES = ["light", "dark"] as const;

export type ColorSchemeName = (typeof COLOR_SCHEMES)[number];

export function isColorSchemeName(value: unknown): value is ColorSchemeName {
  return COLOR_SCHEMES.some((scheme) => scheme === value);
}

type ColorSchemeFrameProps = Readonly<{ scheme: ColorSchemeName; children: ReactNode }>;

/**
 * Applies the toolbar's color scheme through NativeWind, which toggles the `dark` class on
 * `<html>` (Tailwind `darkMode: "class"`) and updates `useColorScheme()` consumers.
 */
export function ColorSchemeFrame({ scheme, children }: ColorSchemeFrameProps) {
  useLayoutEffect(() => {
    colorScheme.set(scheme);
  }, [scheme]);

  return children;
}
