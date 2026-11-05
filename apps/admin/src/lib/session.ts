import { headers } from "next/headers";
import { cache } from "react";
import { z } from "zod";

import { getServerEnv } from "../env";

/**
 * `disableCookieCache`: Better Auth would otherwise answer from the signed `session_data` cookie
 * (up to 5 minutes old) without reading the database, so a role change, ban or revoked session
 * would not reach the back office until it expires (R-ACC-12). Same lookup as the API context.
 */
export const SESSION_PATH = "/api/auth/get-session?disableCookieCache=true";
const SESSION_TIMEOUT_MS = 5_000;

const serverSessionSchema = z
  .object({
    session: z.object({
      id: z.string(),
      userId: z.string(),
      expiresAt: z.coerce.date(),
    }),
    user: z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      image: z.string().nullish(),
      role: z.string().nullish(),
      emailVerified: z.boolean(),
    }),
  })
  .nullable();

export type ServerSession = NonNullable<z.output<typeof serverSessionSchema>>;

/**
 * Session of the current request, resolved by the API (`GET /api/auth/get-session`, always
 * read from the database) with the incoming cookies. Returns `null` when signed out. Deduplicated per request with `cache`.
 *
 * Throws when the API is unreachable or answers unexpectedly, so the error boundary handles it
 * instead of silently treating the user as signed out.
 */
export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  const cookie = (await headers()).get("cookie");
  if (cookie === null || cookie === "") return null;

  const { API_INTERNAL_URL } = getServerEnv();
  const response = await fetch(`${API_INTERNAL_URL}${SESSION_PATH}`, {
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
  });

  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Session lookup failed with HTTP ${response.status}`);
  }

  const parsed = serverSessionSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Session lookup returned an unexpected payload", { cause: parsed.error });
  }
  return parsed.data;
});
