/**
 * Babel config for Metro.
 * - `jsxImportSource: "nativewind"` routes JSX through NativeWind so `className` works on
 *   React Native components (including the ones in `@repo/ui`).
 * - `nativewind/babel` compiles the CSS interop. Reanimated/worklets plugins are added by
 *   `babel-preset-expo` automatically.
 * @param {import("@babel/core").ConfigAPI} api
 */
export default function babelConfig(api) {
  api.cache.forever();
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
}
