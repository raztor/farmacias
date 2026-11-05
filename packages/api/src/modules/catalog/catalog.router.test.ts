import type { PrismaClient } from "@repo/db";
import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../../root";
import { createTestDeps, createTestSession } from "../../testing/fakes";
import { createTRPCContext } from "../../trpc";
import { PRODUCT_NOT_FOUND_MESSAGE } from "./catalog.service";

const PUBLIC_FIELDS = [
  "activeIngredient",
  "availability",
  "availableQty",
  "category",
  "commercialName",
  "id",
  "presentation",
  "priceClp",
].sort();

const dbRow = {
  id: "prod-1",
  commercialName: "Tensivar",
  activeIngredient: "Losartán potásico",
  presentation: "Comprimidos recubiertos 50 mg x 30",
  category: "cardiovascular",
  priceClp: 6990,
  onHand: 2,
  lowStockThreshold: 5,
};

type FakeCatalogDb = {
  $queryRaw?: unknown;
  product?: { findFirst: unknown };
};

/** Real context (anonymous unless `session` is given) over a fake Prisma client. */
const callerWith = async (
  db: FakeCatalogDb,
  session = null as ReturnType<typeof createTestSession> | null,
) =>
  createCaller(
    await createTRPCContext({
      deps: { ...createTestDeps({ session }), db: db as unknown as PrismaClient },
      headers: new Headers(),
      requestId: "test-request",
    }),
  );

describe("catalog router", () => {
  it("answers catalog.search without a session and exposes only public fields (CAT-U06)", async () => {
    const $queryRaw = vi.fn(() => Promise.resolve([dbRow]));
    const caller = await callerWith({ $queryRaw });

    const result = await caller.catalog.search({ q: "losartan" });

    expect(result.nextCursor).toBeNull();
    expect(result.items).toHaveLength(1);
    expect(Object.keys(result.items[0] ?? {}).sort()).toEqual(PUBLIC_FIELDS);
    expect(result.items[0]).toMatchObject({ availableQty: 2, availability: "low" });
    expect($queryRaw).toHaveBeenCalledOnce();
  });

  it("returns the same data to signed-in users", async () => {
    const $queryRaw = vi.fn(() => Promise.resolve([dbRow]));
    const caller = await callerWith(
      { $queryRaw },
      createTestSession({ id: "user-1", role: "resident" }),
    );

    await expect(caller.catalog.search({})).resolves.toMatchObject({ items: [{ id: "prod-1" }] });
  });

  it("answers catalog.byId without a session", async () => {
    const { onHand, lowStockThreshold, ...product } = dbRow;
    const findFirst = vi.fn(() =>
      Promise.resolve({ ...product, inventory: { onHand, lowStockThreshold } }),
    );
    const caller = await callerWith({ product: { findFirst } });

    const summary = await caller.catalog.byId({ id: "prod-1" });

    expect(Object.keys(summary).sort()).toEqual(PUBLIC_FIELDS);
  });

  it("maps a missing product to NOT_FOUND with a Spanish message", async () => {
    const caller = await callerWith({ product: { findFirst: vi.fn(() => Promise.resolve(null)) } });

    await expect(caller.catalog.byId({ id: "ghost" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: PRODUCT_NOT_FOUND_MESSAGE,
    });
  });

  it("rejects invalid input with BAD_REQUEST before touching the database (CAT-U02)", async () => {
    const $queryRaw = vi.fn();
    const caller = await callerWith({ $queryRaw });

    await expect(caller.catalog.search({ q: "x".repeat(101) })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.catalog.search({ limit: 51 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect($queryRaw).not.toHaveBeenCalled();
  });
});
