import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../../root";
import { createTestContext, createTestSession } from "../../testing/fakes";

const admin = createTestSession({ id: "admin-1", role: "admin" });
const regularUser = createTestSession({ id: "user-1", role: "user" });

const row = (id: string) => ({
  id,
  email: `${id}@example.com`,
  name: id,
  image: null,
  role: "user",
  emailVerified: false,
  banned: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
});

describe("admin router", () => {
  it("rejects anonymous callers with UNAUTHORIZED", async () => {
    const caller = createCaller(await createTestContext());

    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects non-admin users with FORBIDDEN", async () => {
    const caller = createCaller(await createTestContext({ session: regularUser }));

    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.listUsers({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.setRole({ userId: "user-1", role: "admin" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
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
      expect.objectContaining({ id: "u3", banned: false, role: "user" }),
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

  it("changes the role of another user", async () => {
    const update = vi.fn(() => Promise.resolve({ ...row("u1"), role: "admin" }));
    const caller = createCaller(
      await createTestContext({ session: admin, db: { user: { update } } }),
    );

    await expect(caller.admin.setRole({ userId: "u1", role: "admin" })).resolves.toMatchObject({
      id: "u1",
      role: "admin",
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: { role: "admin" } }),
    );
  });

  it("maps the self-demotion AppError to FORBIDDEN", async () => {
    const update = vi.fn();
    const caller = createCaller(
      await createTestContext({ session: admin, db: { user: { update } } }),
    );

    await expect(caller.admin.setRole({ userId: "admin-1", role: "user" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "No puedes quitarte tu propio rol de administrador.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects unknown roles with BAD_REQUEST", async () => {
    const caller = createCaller(await createTestContext({ session: admin }));

    await expect(
      caller.admin.setRole({ userId: "u1", role: "owner" as "admin" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
