import { TRPCError } from "@trpc/server";
import type { AuthSession } from "@repo/auth";
import type { PrismaClient } from "@repo/db";
import type { QueueClient } from "@repo/queue";
import type { AppLogger } from "@repo/shared";

/**
 * The slice of the Better Auth instance the API needs. `Auth` from `@repo/auth`
 * satisfies it structurally, and tests can provide a tiny fake.
 */
export type SessionResolver = {
  api: {
    getSession: (input: {
      headers: Headers;
      query?: { disableCookieCache?: boolean };
    }) => Promise<AuthSession | null>;
  };
};

/** Long-lived infrastructure created once by the host (apps/server) and shared by requests. */
export type ApiDependencies = {
  db: PrismaClient;
  auth: SessionResolver;
  queue: QueueClient;
  logger: AppLogger;
};

export type CreateTRPCContextOptions = {
  deps: ApiDependencies;
  /** Incoming request headers (cookies / bearer token are read from here). */
  headers: Headers;
  /** Correlation id of the HTTP request, bound to every log line of the call. */
  requestId: string;
};

/** Per-request context available to every procedure. */
export type TRPCContext = {
  deps: ApiDependencies;
  requestId: string;
  /** Request-scoped logger (`requestId` already bound). */
  logger: AppLogger;
  /** `null` when the request is anonymous. */
  session: AuthSession | null;
};

/**
 * Builds the tRPC context: binds the request id to the logger and resolves the
 * Better Auth session from the request headers.
 *
 * The signed cookie cache is bypassed (`disableCookieCache`): authorization always reads the
 * session and the user's role from the database, so a role change or a revoked session applies
 * to the very next API call instead of after the cache lifetime (5 minutes).
 *
 * A failure to resolve the session (e.g. database down) is not treated as anonymous,
 * which would log users out: it surfaces as INTERNAL_SERVER_ERROR instead.
 */
export const createTRPCContext = async ({
  deps,
  headers,
  requestId,
}: CreateTRPCContextOptions): Promise<TRPCContext> => {
  const logger = deps.logger.child({ requestId });
  try {
    const session = await deps.auth.api.getSession({
      headers,
      query: { disableCookieCache: true },
    });
    return { deps, requestId, logger, session };
  } catch (error) {
    logger.error({ err: error }, "Failed to resolve the session");
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to resolve the session",
      cause: error,
    });
  }
};
