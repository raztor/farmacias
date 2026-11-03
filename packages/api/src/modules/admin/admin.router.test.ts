import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../../root";
import { createTestContext, createTestSession } from "../../testing/fakes";

const admin = createTestSession({ id: "admin-1", role: "admin" });
const resident = createTestSession({ id: "resident-1", role: "resident" });
const operator = createTestSession({ id: "operator-1", role: "operator" });

/** Prisma double whose interactive transaction runs on the same delegates. */
const transactionalDb = (delegates: Record<string, Record<string, unknown>>) => {
  const db = { ...delegates, $transaction: (run: (tx: unknown) => unknown) => run(db) };
  return db;
};

const row = (id: string) => ({
  id,
  email: `${id}@example.com`,
  name: id,
  image: null,
  role: "resident",
  emailVerified: false,
  banned: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

describe("admin router", () => {
  it("rejects anonymous callers with UNAUTHORIZED", async () => {
    const caller = createCaller(await createTestContext());

    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.each([
    ["resident", resident],
    ["operator", operator],
  ])("rejects %s sessions with FORBIDDEN", async (_role, session) => {
    const update = vi.fn();
    const caller = createCaller(
      await createTestContext({ session, db: transactionalDb({ user: { update } }) }),
    );

    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.listUsers({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.admin.setRole({ userId: session.user.id, role: "admin" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(update).not.toHaveBeenCalled();
  });

  it("returns the dashboard stats to admins", async () => {
    const count = vi.fn(() => Promise.resolve(4));
    const caller = createCaller(
      await createTestContext({ session: admin, db: { user: { count }, session: { count } } }),
    );

    await expect(caller.admin.stats()).resolves.toEqual({
      totalUsers: 4,
      newUsersLast7Days: 4,
      activeSessions: 4,
    });
  });

  it("lists users with a case-insensitive search and cursor pagination", async () => {
    const findMany = vi.fn(() => Promise.resolve([row("u3"), row("u2")]));
    const caller = createCaller(
      await createTestContext({ session: admin, db: { user: { findMany } } }),
    );

    const page = await caller.admin.listUsers({ limit: 1, cursor: "u4", search: " Ana " });

    expect(page.items).toEqual([
      expect.objectContaining({ id: "u3", banned: false, role: "resident" }),
    ]);
    expect(page.nextCursor).toBe("u3");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        skip: 1,
        cursor: { id: "u4" },
        where: {
          OR: [
            { email: { contains: "Ana", mode: "insensitive" } },
            { name: { contains: "Ana", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("does not filter when the search is blank", async () => {
    const findMany = vi.fn(() => Promise.resolve([]));
    const caller = createCaller(
      await createTestContext({ session: admin, db: { user: { findMany } } }),
    );

    await expect(caller.admin.listUsers({ search: "  " })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, take: 21 }));
  });

  it("validates the pagination input", async () => {
    const caller = createCaller(await createTestContext({ session: admin }));

    await expect(caller.admin.listUsers({ limit: 500 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("changes the role of another user and audits it in the same transaction", async () => {
    const calls: string[] = [];
    const findUnique = vi.fn(() => {
      calls.push("findUnique");
      return Promise.resolve({ role: "resident" });
    });
    const update = vi.fn(() => {
      calls.push("update");
      return Promise.resolve({ ...row("u1"), role: "operator" });
    });
    const create = vi.fn(() => {
      calls.push("audit");
      return Promise.resolve({});
    });
    const db = transactionalDb({ user: { findUnique, update }, auditLog: { create } });
    const transaction = vi.spyOn(db, "$transaction");
    const caller = createCaller(await createTestContext({ session: admin, db }));

    await expect(caller.admin.setRole({ userId: "u1", role: "operator" })).resolves.toMatchObject({
      id: "u1",
      role: "operator",
    });
    expect(transaction).toHaveBeenCalledOnce();
    expect(calls).toEqual(["findUnique", "update", "audit"]);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: { role: "operator" } }),
    );
    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: "admin-1",
        actorRole: "admin",
        action: "user.role_change",
        entityType: "user",
        entityId: "u1",
        before: { role: "resident" },
        after: { role: "operator" },
      },
    });
  });

  it("answers NOT_FOUND for unknown users without writing anything", async () => {
    const update = vi.fn();
    const create = vi.fn();
    const db = transactionalDb({
      user: { findUnique: vi.fn(() => Promise.resolve(null)), update },
      auditLog: { create },
    });
    const caller = createCaller(await createTestContext({ session: admin, db }));

    await expect(caller.admin.setRole({ userId: "ghost", role: "admin" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("maps the self-demotion AppError to FORBIDDEN", async () => {
    const update = vi.fn();
    const caller = createCaller(
      await createTestContext({ session: admin, db: transactionalDb({ user: { update } }) }),
    );

    await expect(
      caller.admin.setRole({ userId: "admin-1", role: "operator" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "No puedes quitarte tu propio rol de administrador.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects unknown roles with BAD_REQUEST", async () => {
    const caller = createCaller(await createTestContext({ session: admin }));

    await expect(
      caller.admin.setRole({ userId: "u1", role: "user" as "admin" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
