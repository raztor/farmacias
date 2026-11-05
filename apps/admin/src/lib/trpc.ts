"use client";

import type { AppRouter } from "@repo/api";
import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";

/** Same-origin endpoint, proxied to the API by the `/trpc/:path*` rewrite. */
export const TRPC_ENDPOINT = "/trpc";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

/** Browser tRPC client. Sends the Better Auth session cookie with every request. */
export function makeTRPCClient(): TRPCClient<AppRouter> {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: TRPC_ENDPOINT,
        transformer: superjson,
        fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
      }),
    ],
  });
}
