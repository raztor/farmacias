import type { PrismaClient } from "@repo/db";
import { noopLogger } from "@repo/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createProduct,
  createUser,
  disconnectTestDb,
  getTestDb,
  INTEGRATION_ENABLED,
  resetDatabase,
} from "../../testing/integration";
import { createInventoryAdminServiceFromDeps } from "./inventory-admin.service";
import { listInventoryInput, movementsInput } from "./inventory.schema";

/** INV-I14 (docs/specs/inventory.md, R-INV-19): keyset pagination never skips a real row. */
describe.skipIf(!INTEGRATION_ENABLED)("inventory keyset pagination on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();
  const service = () => createInventoryAdminServiceFromDeps({ db: db() }, noopLogger);

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const names = (items: readonly { name: string }[]) => items.map((item) => item.name);

  it("keeps the next low-stock page intact when the cursor product stops being low", async () => {
    const user = await createUser(db(), { role: "operator" });
    const actor = { actorId: user.id, actorRole: "operator" } as const;
    const low = await Promise.all(
      ["Alfa", "Beta", "Gama", "Delta Z"].map((name) =>
        createProduct(db(), { commercialName: `${name} Bajo`, onHand: 1 }),
      ),
    );
    await createProduct(db(), { commercialName: "Beta Ok", onHand: 40 });

    const first = await service().list(listInventoryInput.parse({ limit: 2, onlyLow: true }));
    expect(names(first.items)).toEqual(["Alfa Bajo", "Beta Bajo"]);

    // Someone receives stock for the last product of page 1: it no longer matches the filter.
    const beta = low[1];
    if (!beta) throw new Error("fixture");
    await service().adjust(actor, {
      productId: beta.id,
      kind: "receipt",
      delta: 30,
      reason: "Recepción proveedor",
    });

    const second = await service().list(
      listInventoryInput.parse({ limit: 2, onlyLow: true, cursor: first.nextCursor }),
    );
    expect(names(second.items)).toEqual(["Delta Z Bajo", "Gama Bajo"]);
    expect(second.nextCursor).toBeNull();
  });

  it("pages a product's ledger newest first without gaps", async () => {
    const user = await createUser(db(), { role: "operator" });
    const actor = { actorId: user.id, actorRole: "operator" } as const;
    const product = await createProduct(db(), { onHand: 10 });
    for (const delta of [1, 2, 3]) {
      await service().adjust(actor, {
        productId: product.id,
        kind: "receipt",
        delta,
        reason: `Recepción ${String(delta)}`,
      });
    }

    const first = await service().movements(
      movementsInput.parse({ productId: product.id, limit: 2 }),
    );
    expect(first.items.map((movement) => movement.delta)).toEqual([3, 2]);
    const second = await service().movements(
      movementsInput.parse({ productId: product.id, limit: 2, cursor: first.nextCursor }),
    );
    expect(second.items.map((movement) => movement.delta)).toEqual([1]);
    expect(second.nextCursor).toBeNull();
  });
});
