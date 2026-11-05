/**
 * Metro config.
 *
 * - `getSentryExpoConfig` wraps Expo's `getDefaultConfig`, which detects the pnpm workspace
 *   automatically (watch folders + node_modules paths, SDK 52+), so no monorepo tweaks are needed.
 *   It also adds Sentry debug ids to bundles and source maps.
 * - `withNativeWind` compiles `src/global.css` with the Tailwind config of this app.
 *
 * NativeWind's Babel preset rewrites JSX (also in `@repo/ui`) to import
 * `react-native-css-interop/jsx-runtime`; it resolves because `react-native-css-interop` is a
 * direct dependency of this app (Expo adds `<app>/node_modules` to Metro's lookup paths).
 */
import { createRequire } from "node:module";

/** Both helpers ship as CommonJS without an `exports` map, so they are required. */
const require = createRequire(import.meta.url);
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

const config = getSentryExpoConfig(import.meta.dirname);

export default withNativeWind(config, { input: "./src/global.css" });
