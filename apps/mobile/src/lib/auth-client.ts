import { expoClient } from "@better-auth/expo/client";
import { APP_SCHEME, AUTH_COOKIE_PREFIX } from "@repo/shared";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { env } from "../env";

/**
 * Better Auth client. On iOS/Android the Expo plugin stores the session cookie in SecureStore
 * (keys prefixed with `bnp`) and attaches it to every auth request. On the web the plugin is a
 * no-op: the browser keeps the cookie and requests use `credentials: "include"`. Without
 * `EXPO_PUBLIC_API_URL` (web only) Better Auth uses `window.location.origin` + `/api/auth`.
 */
export const authClient = createAuthClient({
  baseURL: env.EXPO_PUBLIC_API_URL,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: APP_SCHEME,
      cookiePrefix: AUTH_COOKIE_PREFIX,
      storage: SecureStore,
    }),
  ],
});

export type AuthSession = typeof authClient.$Infer.Session;
