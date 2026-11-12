import { buildProductSearchText, type ProductFields } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import { createRecordingLogger } from "../../testing/fakes";
import type { AuditEntryInput } from "../audit";
import type {
  AdminListRepoQuery,
  CatalogAdminRepository,
  NewProductWrite,
  ProductWrite,
} from "./catalog-admin.repository";
import type { AdminProduct } from "./catalog-admin.schema";
import {
  ADMIN_PRODUCT_NOT_FOUND_MESSAGE,
  NEW_PRODUCT_INVENTORY,
  PRODUCT_SKU_TAKEN_MESSAGE,
  PRODUCT_STALE_MESSAGE,
  createCatalogAdminService,
  toProductSnapshot,
} from "./catalog-admin.service";

const UPDATED_AT = new Date("2026-11-01T12:00:00.000Z");
const ACTOR = { actorId: "admin-1", actorRole: "admin" } as const;

const FIELDS: ProductFields = {
  sku: "CAR-TEN50-B1",
  commercialName: "Tensivar",
  activeIngredient: "Losartán potásico",
  presentation: "Comprimidos 50 mg x 30",
  category: "cardiovascular",
  priceClp: 6990,
  active: true,
};

const product = (overrides: Partial<AdminProduct> = {}): AdminProduct => ({
  id: "prod-1",
  ...FIELDS,
  onHand: 12,
  lowStockThreshold: 5,
  updatedAt: UPDATED_AT,
  ...overrides,
});

const uniqueViolation = () => Object.assign(new Error("Unique constraint"), { code: "P2002" });

type FakeOptions = {
  rows?: AdminProduct[];
  stored?: AdminProduct | null;
  insertError?: Error;
  updateError?: Error;
};

/** Fake repository: records writes and audit rows; `transaction` runs inline. */
const createFakeRepo = (options: FakeOptions = {}) => {
  const audits: AuditEntryInput[] = [];
  const inserted: NewProductWrite[] = [];
  const updated: { id: string; data: ProductWrite }[] = [];
  const listQueries: AdminListRepoQuery[] = [];
  const toRow = (id: string, data: ProductWrite): AdminProduct => {
    const { searchText: _searchText, ...fields } = data;
    return product({ ...fields, id, onHand: 0 });
  };
  const repo: CatalogAdminRepository = {
    list: (query) => {
      listQueries.push(query);
      return Promise.resolve(options.rows ?? []);
    },
    findById: (id) => Promise.resolve(options.stored?.id === id ? options.stored : null),
    transaction: (run) =>
      run({
        products: {
          insert: (data) => {
            if (options.insertError) return Promise.reject(options.insertError);
            inserted.push(data);
            return Promise.resolve(toRow("prod-new", data));
          },
          lockById: (id) => Promise.resolve(options.stored?.id === id ? options.stored : null),
          update: (id, data) => {
            if (options.updateError) return Promise.reject(options.updateError);
            updated.push({ id, data });
            return Promise.resolve(toRow(id, data));
          },
        },
        audit: {
          record: (entries) => {
            audits.push(...entries);
            return Promise.resolve();
          },
        },
      }),
  };
  return { repo, audits, inserted, updated, listQueries };
};

describe("catalogAdminService.list (R-CAT-15)", () => {
  it("normalizes the term into distinct words and asks for one extra row", async () => {
    const fake = createFakeRepo();
    const service = createCatalogAdminService({ repo: fake.repo });

    await service.list({ q: "  LOSARTÁN  losartan 50mg ", status: "inactive", limit: 20 });

    expect(fake.listQueries).toEqual([
      { words: ["losartan", "50mg"], status: "inactive", cursor: undefined, take: 21 },
    ]);
  });

  it("lists everything for a missing or symbol-only term", async () => {
    const fake = createFakeRepo();
    const service = createCatalogAdminService({ repo: fake.repo });

    await service.list({ status: "all", limit: 5, cursor: "prod-9" });
    await service.list({ q: "¿?", status: "all", limit: 5 });

    expect(fake.listQueries.map((query) => query.words)).toEqual([[], []]);
    expect(fake.listQueries[0]).toMatchObject({ cursor: "prod-9", take: 6 });
  });

  it("returns nextCursor only when there are more rows than the page size", async () => {
    const rows = [product({ id: "a" }), product({ id: "b" }), product({ id: "c" })];
    const service = createCatalogAdminService({ repo: createFakeRepo({ rows }).repo });

    await expect(service.list({ status: "all", limit: 2 })).resolves.toEqual({
      items: rows.slice(0, 2),
      nextCursor: "b",
    });
    await expect(service.list({ status: "all", limit: 3 })).resolves.toEqual({
      items: rows,
      nextCursor: null,
    });
  });
});

describe("catalogAdminService.byId", () => {
  it("returns any product, including an inactive one", async () => {
    const stored = product({ active: false });
    const service = createCatalogAdminService({ repo: createFakeRepo({ stored }).repo });

    await expect(service.byId("prod-1")).resolves.toEqual(stored);
  });

  it("answers NOT_FOUND for an unknown id", async () => {
    const service = createCatalogAdminService({ repo: createFakeRepo().repo });

    await expect(service.byId("ghost")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: ADMIN_PRODUCT_NOT_FOUND_MESSAGE,
    });
  });
});

describe("catalogAdminService.create (R-CAT-12, R-CAT-14, R-CAT-16)", () => {
  it("stores the search text, no stock and the default threshold", async () => {
    const fake = createFakeRepo();
    const service = createCatalogAdminService({ repo: fake.repo });

    const created = await service.create({ ...FIELDS, ...ACTOR });

    expect(fake.inserted).toEqual([
      { ...FIELDS, searchText: buildProductSearchText(FIELDS), inventory: NEW_PRODUCT_INVENTORY },
    ]);
    expect(NEW_PRODUCT_INVENTORY).toEqual({ onHand: 0, lowStockThreshold: 5 });
    expect(created).toMatchObject({ id: "prod-new", priceClp: 6990, onHand: 0 });
  });

  it("writes a product.create audit row with before null and the product after", async () => {
    const fake = createFakeRepo();
    const { logger, entries } = createRecordingLogger();
    const service = createCatalogAdminService({ repo: fake.repo, logger });

    await service.create({ ...FIELDS, ...ACTOR });

    expect(fake.audits).toEqual([
      {
        ...ACTOR,
        action: "product.create",
        entityType: "product",
        entityId: "prod-new",
        before: null,
        after: toProductSnapshot(FIELDS),
      },
    ]);
    expect(entries).toEqual([expect.objectContaining({ level: "info", msg: "Product created" })]);
  });

  it("maps a duplicate SKU to CONFLICT with a Spanish message", async () => {
    const fake = createFakeRepo({ insertError: uniqueViolation() });
    const service = createCatalogAdminService({ repo: fake.repo });

    await expect(service.create({ ...FIELDS, ...ACTOR })).rejects.toMatchObject({
      code: "CONFLICT",
      message: PRODUCT_SKU_TAKEN_MESSAGE,
    });
    expect(fake.audits).toEqual([]);
  });

  it("rethrows any other failure untouched", async () => {
    const failure = new Error("connection lost");
    const service = createCatalogAdminService({
      repo: createFakeRepo({ insertError: failure }).repo,
    });

    await expect(service.create({ ...FIELDS, ...ACTOR })).rejects.toBe(failure);
  });
});

describe("catalogAdminService.update (R-CAT-13, R-CAT-16, R-CAT-17)", () => {
  it("writes the new fields with a recomputed search text", async () => {
    const fake = createFakeRepo({ stored: product() });
    const service = createCatalogAdminService({ repo: fake.repo });
    const changes = { ...FIELDS, commercialName: "Tensivar Forte", priceClp: 7490 };

    const result = await service.update({
      id: "prod-1",
      expectedUpdatedAt: UPDATED_AT,
      ...changes,
      ...ACTOR,
    });

    expect(fake.updated).toEqual([
      { id: "prod-1", data: { ...changes, searchText: buildProductSearchText(changes) } },
    ]);
    expect(result).toMatchObject({ commercialName: "Tensivar Forte", priceClp: 7490 });
  });

  it("audits product.update with the product before and after (price and status)", async () => {
    const fake = createFakeRepo({ stored: product() });
    const service = createCatalogAdminService({ repo: fake.repo });

    await service.update({
      id: "prod-1",
      expectedUpdatedAt: UPDATED_AT,
      ...FIELDS,
      priceClp: 5990,
      active: false,
      ...ACTOR,
    });

    expect(fake.audits).toEqual([
      {
        ...ACTOR,
        action: "product.update",
        entityType: "product",
        entityId: "prod-1",
        before: toProductSnapshot(FIELDS),
        after: toProductSnapshot({ ...FIELDS, priceClp: 5990, active: false }),
      },
    ]);
  });

  it("writes nothing and audits nothing when no field changed", async () => {
    const stored = product();
    const fake = createFakeRepo({ stored });
    const service = createCatalogAdminService({ repo: fake.repo });

    await expect(
      service.update({ id: "prod-1", expectedUpdatedAt: UPDATED_AT, ...FIELDS, ...ACTOR }),
    ).resolves.toEqual(stored);
    expect(fake.updated).toEqual([]);
    expect(fake.audits).toEqual([]);
  });

  it("answers CONFLICT and writes nothing when the product changed since it was loaded (R-CAT-18)", async () => {
    const fake = createFakeRepo({ stored: product() });
    const service = createCatalogAdminService({ repo: fake.repo });
    const loadedBefore = new Date(UPDATED_AT.getTime() - 1);

    await expect(
      service.update({
        id: "prod-1",
        expectedUpdatedAt: loadedBefore,
        ...FIELDS,
        priceClp: 100,
        ...ACTOR,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: PRODUCT_STALE_MESSAGE });
    expect(fake.updated).toEqual([]);
    expect(fake.audits).toEqual([]);
  });

  it("answers NOT_FOUND for an unknown product", async () => {
    const fake = createFakeRepo();
    const service = createCatalogAdminService({ repo: fake.repo });

    await expect(
      service.update({ id: "ghost", expectedUpdatedAt: UPDATED_AT, ...FIELDS, ...ACTOR }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(fake.audits).toEqual([]);
  });

  it("maps a SKU already used by another product to CONFLICT", async () => {
    const fake = createFakeRepo({ stored: product(), updateError: uniqueViolation() });
    const service = createCatalogAdminService({ repo: fake.repo });

    await expect(
      service.update({
        id: "prod-1",
        expectedUpdatedAt: UPDATED_AT,
        ...FIELDS,
        sku: "OTRO-SKU",
        ...ACTOR,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: PRODUCT_SKU_TAKEN_MESSAGE });
  });

  it("logs the change without product data beyond ids", async () => {
    const { logger, entries } = createRecordingLogger();
    const service = createCatalogAdminService({
      repo: createFakeRepo({ stored: product() }).repo,
      logger,
    });
    const info = vi.spyOn(logger, "info");

    await service.update({
      id: "prod-1",
      expectedUpdatedAt: UPDATED_AT,
      ...FIELDS,
      priceClp: 100,
      ...ACTOR,
    });

    expect(info).toHaveBeenCalledOnce();
    expect(entries[0]?.obj).toEqual({ actorId: "admin-1", productId: "prod-1" });
  });
});
