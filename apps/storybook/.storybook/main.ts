import { defineMain } from "@storybook/react-native-web-vite/node";
import { mergeConfig } from "vite";

import { cssInteropResolver } from "./css-interop-resolver.ts";

/**
 * Packages that ship untranspiled React Native / JSX code and must go through the
 * react-native-web Babel pipeline. `react-native`, `@react-native`, `expo` and `@expo` are added
 * by the framework. `@repo/ui` is consumed as TypeScript source.
 */
const MODULES_TO_TRANSPILE = ["nativewind", "react-native-css-interop", "@repo/ui"];

/**
 * The framework's default `exclude` (`/node_modules/(?!pkg)/`) never matches pnpm's layout
 * (`node_modules/.pnpm/<pkg>@<version>/node_modules/<pkg>`), so it is rebuilt here to also
 * accept the `.pnpm` store prefix.
 */
const TRANSPILED = ["react-native", "@react-native", "expo", "@expo", ...MODULES_TO_TRANSPILE];
const NODE_MODULES_EXCLUDE = new RegExp(
  `/node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:${TRANSPILED.join("|")})(?:[/@-]|$))`,
);

export default defineMain({
  stories: ["../src/**/*.mdx", "../../../packages/ui/src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-native-web-vite",
    options: {
      modulesToTranspile: MODULES_TO_TRANSPILE,
      pluginReactOptions: {
        exclude: NODE_MODULES_EXCLUDE,
        // NativeWind 4: `className` support comes from react-native-css-interop's JSX runtime.
        jsxImportSource: "nativewind",
        babel: {
          // Rewrites `React.createElement` calls and wires the css-interop JSX runtime and the
          // Reanimated/Worklets plugin, exactly as on native (resolved from this workspace).
          presets: ["nativewind/babel"],
        },
      },
    },
  },
  core: { disableTelemetry: true },
  docs: { defaultName: "Documentación" },
  viteFinal: (config) =>
    mergeConfig(config, {
      plugins: [cssInteropResolver()],
      resolve: {
        // `react-native` is aliased to `react-native-web`, which @repo/ui (outside this
        // workspace) cannot resolve on its own. Deduping resolves these singletons from this
        // workspace for every importer, so stories share one React / RNW / NativeWind instance.
        dedupe: ["react", "react-dom", "react-native-web", "nativewind"],
      },
    }),
});
