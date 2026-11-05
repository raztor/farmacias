import type { PrismaClient, User } from "@repo/db";
import type { Role } from "@repo/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCaller } from "../../root";
import { createTestDeps, createTestSession } from "../../testing/fakes";
import {
  createOrder,
  createProduct,
  createUser,
  disconnectTestDb,
  getTestDb,
  INTEGRATION_ENABLED,
  resetDatabase,
} from "../../testing/integration";
import { createTRPCContext } from "../../trpc";

const T0 = Date.parse("2026-11-01T09:00:00.000Z");

/** OPS-I05, OPS-I06 (docs/specs/operations.md): queue pagination and FIFO on PostgreSQL. */
describe.skipIf(!INTEGRATION_ENABLED)("operations queue on PostgreSQL", () => {
  const db = (): PrismaClient => getTestDb();

  const callerFor = async (user: Pick<User, "id">, role: Role) =>
    createCaller(
      await createTRPCContext({
        deps: {
          ...createTestDeps({ session: createTestSession({ id: user.id, role }) }),
          db: db(),
        },
        headers: new Headers(),
        requestId: "operations-queue-int",
      }),
    );

  /** A `payment_validated` pickup order created `minute` minutes after T0. */
  const validatedAt = async (residentId: string, minute: number) => {
    const order = await createOrder(db(), residentId, {
      status: "payment_validated",
      fulfillment: "pickup",
    });
    return db().order.update({
      where: { id: order.id },
      data: { createdAt: new Date(T0 + minute * 60_000) },
    });
  };

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("«Cargar más» skips nobody when the cursor order leaves the filter (R-OPS-02)", async () => {
    const resident = await createUser(db());
    const operator = await createUser(db(), { role: "operator" });
    const other = await createUser(db(), { role: "operator" });
    const orders = [];
    for (let minute = 0; minute < 4; minute += 1) {
      orders.push(await validatedAt(resident.id, minute));
    }
    const ids = orders.map((order) => order.id);
    const caller = await callerFor(operator, "operator");
    const filter = { limit: 2, status: ["payment_validated" as const] };

    const first = await caller.operations.queue(filter);
    expect(first.items.map((item) => item.id)).toEqual(ids.slice(0, 2));

    // Another operator moves the last order of the page out of the filter.
    await (
      await callerFor(other, "operator")
    ).operations.transition({ id: ids[1] ?? "", to: "in_preparation", expectedVersion: 0 });
    const second = await caller.operations.queue({
      ...filter,
      cursor: first.nextCursor ?? undefined,
    });

    expect(second.items.map((item) => item.id)).toEqual(ids.slice(2));
    expect(second.nextCursor).toBeNull();
  });

  it("orders the queue by confirmation, not by when the cart was opened (R-OPS-02)", async () => {
    const product = await createProduct(db(), { onHand: 10 });
    const early = await createUser(db());
    const late = await createUser(db());
    const operator = await createUser(db(), { role: "operator" });
    const earlyCaller = await callerFor(early, "resident");
    const lateCaller = await callerFor(late, "resident");
    const confirm = async (caller: typeof earlyCaller) => {
      await caller.orders.setFulfillment({ type: "pickup" });
      const draft = await caller.orders.draft();
      return caller.orders.confirm({ expectedVersion: draft?.version ?? -1 });
    };

    // The early resident opens the cart first but confirms last.
    const cart = await earlyCaller.orders.addItem({ productId: product.id, quantity: 1 });
    await db().order.update({ where: { id: cart.id }, data: { createdAt: new Date(T0) } });
    await lateCaller.orders.addItem({ productId: product.id, quantity: 1 });
    const lateOrder = await confirm(lateCaller);
    const earlyOrder = await confirm(earlyCaller);

    const queue = await (
      await callerFor(operator, "operator")
    ).operations.queue({ status: ["pending_payment"] });
    expect(queue.items.map((item) => item.id)).toEqual([lateOrder.id, earlyOrder.id]);
  });
});
