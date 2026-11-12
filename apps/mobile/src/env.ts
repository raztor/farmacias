import { createEnv } from "@repo/shared";
import { Platform } from "react-native";
import { z } from "zod";

const apiUrlSchema = z
  .url({
    protocol: /^https?$/,
    error: "EXPO_PUBLIC_API_URL must be an http(s) URL",
  })
  .transform((url) => url.replace(/\/+$/, ""));

/**
 * Public, build-time configuration. Expo inlines `process.env.EXPO_PUBLIC_*` only when the
 * variable is read literally, so every variable is listed explicitly below.
 *
 * `EXPO_PUBLIC_API_URL` is required on iOS/Android. On the web it is optional: when empty, the
 * auth and tRPC clients call the page's own origin (`/api/auth/*`, `/trpc/*`), which the web
 * server (Caddy, see `apps/mobile/Caddyfile`) proxies to the API so cookies stay same-origin.
 */
export const env = createEnv(
  z.object({
    EXPO_PUBLIC_API_URL: Platform.OS === "web" ? apiUrlSchema.optional() : apiUrlSchema,
    EXPO_PUBLIC_SENTRY_DSN: z.url().optional(),
  }),
  {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  },
);

export type Env = typeof env;
