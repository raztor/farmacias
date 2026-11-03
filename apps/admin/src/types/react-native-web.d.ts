/**
 * Minimal types for the parts of `react-native-web` imported directly by the app (the package
 * ships no TypeScript declarations). Components are imported through `@repo/ui`, typed with
 * React Native's own types.
 */
declare module "react-native-web" {
  type StyleSheetSnapshot = { id: string; textContent: string };

  export const StyleSheet: {
    /** CSS generated so far by react-native-web (used for server rendering). */
    getSheet(): StyleSheetSnapshot;
  };
}
