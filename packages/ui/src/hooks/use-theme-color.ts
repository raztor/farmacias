import { getThemeColor, type SemanticColor } from "@repo/tailwind-config";
import { useColorScheme } from "nativewind";

/**
 * Raw value of a semantic color for the active color scheme, for props that do not accept
 * classes (`ActivityIndicator#color`, `placeholderTextColor`, icon colors).
 */
export function useThemeColor(token: SemanticColor): string {
  const { colorScheme } = useColorScheme();
  return getThemeColor(token, colorScheme ?? "light");
}
