import type { AuthSession } from "@repo/auth";
import type { PrismaClient } from "@repo/db";
import type { QueueClient } from "@repo/queue";
import type { AppLogger, Role } from "@repo/shared";

import { createTRPCContext, type ApiDependencies, type TRPCContext } from "../trpc";

/**
 * Test doubles shared by router-level tests. Kept free of `vitest` imports so this file
 * never depends on dev-only packages at runtime.
 */

export type LogEntry = {
  level: "debug" | "info" | "warn" | "error";
  obj: object;
  msg: string | undefined;
};

/** Logger that records every entry (children write to the same list). */
export const createRecordingLogger = (): { logger: AppLogger; entries: LogEntry[] } => {
  const entries: LogEntry[] = [];
  const build = (bindings: Record<string, unknown>): AppLogger => {
    const log =
      (level: LogEntry["level"]) =>
      (obj: object, msg?: string): void => {
        entries.push({ level, obj: { ...bindings, ...obj }, msg });
      };
    return {
      debug: log("debug"),
      info: log("info"),
      warn: log("warn"),
      error: log("error"),
      child: (child) => build({ ...bindings, ...child }),
    };
  };
  return { logger: build({}), entries };
};

export const createTestSession = (user: { id: string; role: Role }): AuthSession => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    session: {
      id: `session-${user.id}`,
      token: `token-${user.id}`,
      userId: user.id,
      expiresAt: new Date("2026-02-01T00:00:00.000Z"),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
      impersonatedBy: null,
    },
    user: {
      id: user.id,
      email: `${user.id}@example.com`,
      name: `User ${user.id}`,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
      role: user.role,
      banned: false,
      banReason: null,
      banExpires: null,
    },
  };
};

const notStubbed = (name: string) => (): never => {
  throw new Error(`${name} is not stubbed in this test`);
};

const fakeQueue: QueueClient = {
  enqueue: notStubbed("queue.enqueue"),
  ping: () => Promise.resolve(true),
  close: () => Promise.resolve(),
};

export type FakeDb = {
  user?: Record<string, unknown>;
  session?: Record<string, unknown>;
};

export type TestContextOptions = {
  session?: AuthSession | null;
  /** Prisma delegates used by the repositories under test. */
  db?: FakeDb;
  logger?: AppLogger;
};

export const createTestDeps = (options: TestContextOptions = {}): ApiDependencies => ({
  db: { user: {}, session: {}, ...options.db } as unknown as PrismaClient,
  auth: { api: { getSession: () => Promise.resolve(options.session ?? null) } },
  queue: fakeQueue,
  logger: options.logger ?? createRecordingLogger().logger,
});

/** Context built through the real `createTRPCContext`, with fake dependencies. */
export const createTestContext = (options: TestContextOptions = {}): Promise<TRPCContext> =>
  createTRPCContext({
    deps: createTestDeps(options),
    headers: new Headers(),
    requestId: "test-request",
  });
