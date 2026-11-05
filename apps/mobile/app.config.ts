import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Expo app config. Build-time values come from environment variables:
 * - `EAS_PROJECT_ID`: EAS project id, printed by `eas init`. Required for EAS Build / EAS Update.
 * - `APP_VARIANT`: `development` | `preview` | `production` (set per profile in `eas.json`).
 *
 * Sentry source map upload reads `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` from the
 * EAS environment, so no secret is committed here.
 */
/**
 * Deep link scheme. Must equal `APP_SCHEME` of `@repo/shared`: the auth client stores the session
 * under it and the API always trusts `bnp://`. Expo loads this file with Node, which cannot import
 * the TypeScript source of `@repo/shared`, so the value is repeated here: change both together.
 */
const APP_SCHEME = "bnp";
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;
const APP_VARIANT = process.env.APP_VARIANT ?? "development";

const APP_NAME = "Farmacia Comunitaria Peñalolén";
/** Non-production builds show the variant in the launcher name to tell them apart. */
const DISPLAY_NAME = APP_VARIANT === "production" ? APP_NAME : `${APP_NAME} (${APP_VARIANT})`;

const BUNDLE_ID = "cl.bnp.farmacias";
const BACKGROUND_COLOR = "#ffffff";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: DISPLAY_NAME,
  slug: "farmacias",
  scheme: APP_SCHEME,
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  backgroundColor: BACKGROUND_COLOR,
  runtimeVersion: { policy: "appVersion" },
  updates: {
    // EAS Update URL is derived from the project id; without it updates stay disabled.
    enabled: EAS_PROJECT_ID !== undefined,
    ...(EAS_PROJECT_ID === undefined ? {} : { url: `https://u.expo.dev/${EAS_PROJECT_ID}` }),
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
  },
  android: {
    package: BUNDLE_ID,
  },
  web: {
    // Single-page app (one index.html): served by Caddy with an SPA fallback (Dockerfile.web).
    output: "single",
    bundler: "metro",
    name: APP_NAME,
    shortName: "Farmacia",
    lang: "es-CL",
    themeColor: BACKGROUND_COLOR,
    backgroundColor: BACKGROUND_COLOR,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    [
      "expo-splash-screen",
      { backgroundColor: BACKGROUND_COLOR, dark: { backgroundColor: "#09090b" } },
    ],
    // Organization, project and auth token come from SENTRY_* env vars at build time.
    "@sentry/react-native",
  ],
  extra: {
    eas: {
      // Set EAS_PROJECT_ID (from `eas init`) in the EAS environment / your shell.
      ...(EAS_PROJECT_ID === undefined ? {} : { projectId: EAS_PROJECT_ID }),
    },
  },
});
