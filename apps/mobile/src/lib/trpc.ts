import type { AppRouter } from "@repo/api";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { Platform } from "react-native";
import superjson from "superjson";

import { env } from "../env";
import { authClient } from "./auth-client";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

const IS_WEB = Platform.OS === "web";

/** Empty base URL (web only) = same origin: the web server proxies `/trpc/*` to the API. */
const TRPC_URL = `${env.EXPO_PUBLIC_API_URL ?? ""}/trpc`;

/**
 * Native: the Better Auth session cookie lives in SecureStore and is sent explicitly, so
 * `credentials: "omit"` keeps the native cookie jar out of the way.
 * Web: the browser owns the (httpOnly) session cookie; SecureStore does not exist there, so the
 * request just includes the browser cookies.
 */
async function sessionHeaders(): Promise<Record<string, string>> {
  if (IS_WEB) return {};
  const cookie = await authClient.getCookie();
  return cookie === "" ? {} : { cookie };
}

const CREDENTIALS: RequestCredentials = IS_WEB ? "include" : "omit";

/** tRPC client that talks to the API and forwards the Better Auth session. */
export function createTrpcClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        transformer: superjson,
        headers: sessionHeaders,
        fetch: (input, init) => fetch(input, { ...init, credentials: CREDENTIALS }),
      }),
    ],
  });
}
