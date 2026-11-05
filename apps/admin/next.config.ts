import path from "node:path";

import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

/**
 * Next.js 16 (Turbopack) config for the admin backoffice.
 *
 * Loaded by Node's native TypeScript support, so this file only imports packages (no relative
 * TS modules) and reads `process.env` directly instead of going through `src/env.ts`.
 */

const REPO_ROOT = path.join(import.meta.dirname, "../..");
const DEFAULT_API_INTERNAL_URL = "http://localhost:4000";

const skipEnvValidation = ["1", "true"].includes(process.env.SKIP_ENV_VALIDATION ?? "");

/**
 * Base URL of the API (`apps/server`) used by the rewrites. Rewrites are resolved at build time
 * (routes manifest), so `API_INTERNAL_URL` must be set when running `next build`.
 */
function resolveApiInternalUrl(): string {
  const value = process.env.API_INTERNAL_URL;
  if (value === undefined || value === "") {
    if (skipEnvValidation) return DEFAULT_API_INTERNAL_URL;
    throw new Error(
      "Invalid environment variables:\n  - API_INTERNAL_URL: required (e.g. http://localhost:4000)",
    );
  }
  if (!URL.canParse(value)) {
    throw new Error(`Invalid environment variables:\n  - API_INTERNAL_URL: invalid URL "${value}"`);
  }
  return value.replace(/\/+$/, "");
}

const apiInternalUrl = resolveApiInternalUrl();

/** "CSP-light": restrictions that do not need nonces for Next.js inline scripts. */
const CONTENT_SECURITY_POLICY = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Private backoffice: never indexed by search engines.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

/** Web-first resolution so `*.web.tsx` files win over the native ones. */
const RESOLVE_EXTENSIONS = [
  ".web.tsx",
  ".web.ts",
  ".web.jsx",
  ".web.mjs",
  ".web.js",
  ".tsx",
  ".ts",
  ".jsx",
  ".mjs",
  ".js",
  ".json",
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: REPO_ROOT,
  poweredByHeader: false,
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; RN libraries ship untranspiled/Flow-free ESM+CJS.
  transpilePackages: [
    "@repo/ui",
    "@repo/shared",
    "@repo/tailwind-config",
    "nativewind",
    "react-native-css-interop",
    "react-native-web",
  ],
  turbopack: {
    root: REPO_ROOT,
    resolveAlias: {
      "react-native": "react-native-web",
      // Optional peer of react-native-css-interop (wrapped in try/catch). Turbopack does not apply
      // `resolveExtensions` inside node_modules, so its native `*.js` files (not `*.web.js`) would
      // be bundled and fail on Flow syntax. Safe areas on the web come from CSS `env()`.
      "react-native-safe-area-context": false,
    },
    resolveExtensions: RESOLVE_EXTENSIONS,
  },
  rewrites() {
    return Promise.resolve([
      { source: "/api/auth/:path*", destination: `${apiInternalUrl}/api/auth/:path*` },
      { source: "/trpc/:path*", destination: `${apiInternalUrl}/trpc/:path*` },
    ]);
  },
  headers() {
    return Promise.resolve([{ source: "/:path*", headers: SECURITY_HEADERS }]);
  },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

/**
 * Sentry is a no-op without DSN (see `instrumentation*.ts`) and only uploads source maps when
 * `SENTRY_AUTH_TOKEN` (plus `SENTRY_ORG` / `SENTRY_PROJECT`) is present.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: sentryAuthToken,
  silent: true,
  telemetry: false,
  sourcemaps: { disable: sentryAuthToken === undefined || sentryAuthToken === "" },
  widenClientFileUpload: true,
});
