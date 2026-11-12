import type { PrismaClient } from "@repo/db";
import { buildProductSearchText, noopLogger, type Role } from "@repo/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createCaller } from "../../root";
import { createTestDeps, createTestSession } from "../../testing/fakes";
import {
  createProduct,
  createUser,
  disconnectTestDb,
  getTestDb,
  INTEGRATION_ENABLED,
  resetDatabase,
} from "../../testing/integration";
import { createTRPCContext } from "../../trpc";
import { createOrdersServiceFromDeps } from "../orders";

const NEW_PRODUCT = {
  sku: "it-hu11-001",
  commercialName: "Mantenol",
  activeIngredient: "Paracetamol",
  presentation: "Comprimidos 500 mg x 16",
  category: "analgesicos",
  priceClp: 1490,
  active: true,
} as const;

/** HU-11 (D-28): catalog maintenance over the real database, through the tRPC router. */
describe.skipIf(!INTEGRATION_ENABLED)("catalog maintenance (PostgreSQL)", () => {
  const db = (): PrismaClient => getTestDb();

  const callerFor = async (user: { id: string; role: Role } | null) =>
    createCaller(
      await createTRPCContext({
        deps: {
          ...createTestDeps({ session: user ? createTestSession(user) : null }),
          db: db(),
        },
        headers: new Headers(),
        requestId: "catalog-admin-int",
      }),
    );

  const adminCaller = async () => {
    const admin = await createUser(db(), { role: "admin" });
    return { admin, caller: await callerFor({ id: admin.id, role: "admin" }) };
  };

  const auditRows = (entityId: string) =>
    db().auditLog.findMany({ where: { entityId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });

  beforeEach(async () => {
    await resetDatabase(db());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("creates a product with stock 0, the default threshold and its audit row (CAT-I05)", async () => {
    const { admin, caller } = await adminCaller();

    const created = await caller.catalog.create(NEW_PRODUCT);

    expect(created).toMatchObject({ sku: "IT-HU11-001", onHand: 0, lowStockThreshold: 5 });
    const stored = await db().product.findUniqueOrThrow({
      where: { id: created.id },
      include: { inventory: true },
    });
    expect(stored.searchText).toBe(buildProductSearchText(NEW_PRODUCT));
    expect(stored.inventory).toMatchObject({ onHand: 0, lowStockThreshold: 5 });
    const [row, ...rest] = await auditRows(created.id);
    expect(rest).toEqual([]);
    expect(row).toMatchObject({
      action: "product.create",
      entityType: "product",
      actorId: admin.id,
      actorRole: "admin",
      before: null,
      after: { ...NEW_PRODUCT, sku: "IT-HU11-001" },
    });
  });

  it("shows a new product in the public search right away (CAT-I05)", async () => {
    const { caller } = await adminCaller();
    const created = await caller.catalog.create(NEW_PRODUCT);
    const visitor = await callerFor(null);

    const { items } = await visitor.catalog.search({ q: "mantenol" });

    expect(items).toEqual([
      expect.objectContaining({ id: created.id, priceClp: 1490, availability: "out" }),
    ]);
  });

  it("updates the price and audits it with before / after (CAT-I06)", async () => {
    const { admin, caller } = await adminCaller();
    const product = await createProduct(db(), { priceClp: 2990, commercialName: "Precio Uno" });
    const fields = {
      sku: product.sku,
      commercialName: "Precio Uno",
      activeIngredient: product.activeIngredient,
      presentation: product.presentation,
      category: "otros",
      active: true,
    } as const;

    const updated = await caller.catalog.update({
      id: product.id,
      expectedUpdatedAt: product.updatedAt,
      ...fields,
      priceClp: 3490,
    });

    expect(updated.priceClp).toBe(3490);
    const visitor = await callerFor(null);
    await expect(visitor.catalog.byId({ id: product.id })).resolves.toMatchObject({
      priceClp: 3490,
    });
    const rows = await auditRows(product.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "product.update",
      actorId: admin.id,
      before: { ...fields, priceClp: 2990 },
      after: { ...fields, priceClp: 3490 },
    });

    // Saving the same values again writes no audit row.
    await caller.catalog.update({
      id: product.id,
      expectedUpdatedAt: updated.updatedAt,
      ...fields,
      priceClp: 3490,
    });
    await expect(auditRows(product.id)).resolves.toHaveLength(1);
  });

  it("rejects a save based on a stale version with CONFLICT (CAT-I10, R-CAT-18)", async () => {
    const { caller } = await adminCaller();
    const created = await caller.catalog.create(NEW_PRODUCT);
    // The version both admins loaded, a minute ago (so the first save surely gets a newer one).
    const loaded = new Date(Date.now() - 60_000);
    await db().product.update({ where: { id: created.id }, data: { updatedAt: loaded } });
    const first = await caller.catalog.update({
      ...NEW_PRODUCT,
      id: created.id,
      expectedUpdatedAt: loaded,
      priceClp: 1590,
    });

    // A second admin still holding the version loaded before the first save.
    await expect(
      caller.catalog.update({
        ...NEW_PRODUCT,
        id: created.id,
        expectedUpdatedAt: loaded,
        priceClp: 990,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "El producto cambió mientras lo editabas. Recarga para ver los cambios.",
    });

    await expect(caller.catalog.adminById({ id: created.id })).resolves.toMatchObject({
      priceClp: 1590,
      updatedAt: first.updatedAt,
    });
    await expect(auditRows(created.id)).resolves.toHaveLength(2);
  });

  it("rejects a duplicate SKU with CONFLICT and writes nothing (CAT-I07)", async () => {
    const { caller } = await adminCaller();
    const existing = await createProduct(db(), { sku: "IT-DUPLICADO" });
    const other = await createProduct(db(), { sku: "IT-OTRO" });

    await expect(
      caller.catalog.create({ ...NEW_PRODUCT, sku: "it-duplicado" }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "Ya existe un producto con ese SKU." });
    await expect(
      caller.catalog.update({
        id: other.id,
        expectedUpdatedAt: other.updatedAt,
        ...NEW_PRODUCT,
        sku: existing.sku,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(db().product.count()).resolves.toBe(2);
    await expect(db().auditLog.count()).resolves.toBe(0);
    await expect(
      db().product.findUniqueOrThrow({ where: { id: other.id } }),
    ).resolves.toMatchObject({ sku: "IT-OTRO" });
  });

  it("deactivates a product: gone from the public catalog, still listed for the admin (CAT-I08)", async () => {
    const { caller } = await adminCaller();
    const created = await caller.catalog.create({ ...NEW_PRODUCT, commercialName: "Retirable" });
    const visitor = await callerFor(null);
    await expect(visitor.catalog.search({ q: "retirable" })).resolves.toMatchObject({
      items: [{ id: created.id }],
    });

    await caller.catalog.update({
      ...NEW_PRODUCT,
      id: created.id,
      expectedUpdatedAt: created.updatedAt,
      commercialName: "Retirable",
      active: false,
    });

    await expect(visitor.catalog.search({ q: "retirable" })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    await expect(visitor.catalog.byId({ id: created.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const inactive = await caller.catalog.adminList({ q: "retirable", status: "inactive" });
    expect(inactive.items.map((item) => [item.id, item.active])).toEqual([[created.id, false]]);
    await expect(caller.catalog.adminById({ id: created.id })).resolves.toMatchObject({
      active: false,
    });
    const [, update] = await auditRows(created.id);
    expect(update).toMatchObject({ before: { active: true }, after: { active: false } });
  });

  it("filters the admin list by name or SKU and pages through it (CAT-I08)", async () => {
    const { caller } = await adminCaller();
    const a = await createProduct(db(), { commercialName: "Alfa Filtro", sku: "IT-ZQX-A" });
    const b = await createProduct(db(), { commercialName: "Beta Filtro", active: false });
    await createProduct(db(), { commercialName: "Gamma", sku: "IT-OTRA-C" });

    const byName = await caller.catalog.adminList({ q: "FILTRO", limit: 1 });
    expect(byName.items.map((item) => item.id)).toEqual([a.id]);
    const next = await caller.catalog.adminList({
      q: "filtro",
      limit: 1,
      cursor: byName.nextCursor ?? "",
    });
    expect(next).toMatchObject({ items: [{ id: b.id, active: false }], nextCursor: null });
    const bySku = await caller.catalog.adminList({ q: "zqx-a" });
    expect(bySku.items.map((item) => item.id)).toEqual([a.id]);
  });

  it("keeps the captured price of confirmed orders; drafts take the new one on confirm (CAT-I09, D-16, R-ORD-11)", async () => {
    const { caller } = await adminCaller();
    const product = await createProduct(db(), { priceClp: 1000, onHand: 20 });
    const orders = createOrdersServiceFromDeps({ db: db() }, noopLogger);
    const confirmedBy = await createUser(db());
    const draftBy = await createUser(db());
    await orders.addItem({ residentId: confirmedBy.id, productId: product.id, quantity: 2 });
    const before = await orders.setFulfillment({ residentId: confirmedBy.id, type: "pickup" });
    await orders.confirm({ residentId: confirmedBy.id, expectedVersion: before.version });
    await orders.addItem({ residentId: draftBy.id, productId: product.id, quantity: 1 });

    await caller.catalog.update({
      id: product.id,
      expectedUpdatedAt: product.updatedAt,
      sku: product.sku,
      commercialName: product.commercialName,
      activeIngredient: product.activeIngredient,
      presentation: product.presentation,
      category: "otros",
      priceClp: 1500,
      active: true,
    });

    const confirmed = await db().order.findUniqueOrThrow({
      where: { id: before.id },
      include: { lines: true },
    });
    expect(confirmed).toMatchObject({ status: "pending_payment", totalClp: 2000 });
    expect(confirmed.lines[0]).toMatchObject({ unitPriceClp: 1000, lineTotalClp: 2000 });
    const draft = await orders.setFulfillment({ residentId: draftBy.id, type: "pickup" });
    const summary = await orders.confirm({
      residentId: draftBy.id,
      expectedVersion: draft.version,
    });
    expect(summary.totalClp).toBe(1500);
  });
});
