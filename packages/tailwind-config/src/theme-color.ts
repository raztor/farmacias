import { colors } from "./tokens";
import type { ColorScheme, SemanticColor } from "./tokens.types";

/**
 * Returns the raw value of a semantic color for a color scheme.
 * For React Native props that do not accept classes (`placeholderTextColor`, icon colors,
 * `ActivityIndicator`, navigation themes, `StatusBar`).
 */
export function getThemeColor(token: SemanticColor, scheme: ColorScheme = "light"): string {
  const color = colors[token];
  return scheme === "dark" ? color.dark : color.DEFAULT;
}
