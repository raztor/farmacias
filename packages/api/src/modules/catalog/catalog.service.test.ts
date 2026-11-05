import { AppError } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import type { CatalogProductRow, CatalogRepository } from "./catalog.repository";
import {
  createCatalogService,
  createCatalogServiceFromDeps,
  PRODUCT_NOT_FOUND_MESSAGE,
  toAvailability,
  toProductSummary,
} from "./catalog.service";

const row = (overrides: Partial<CatalogProductRow> = {}): CatalogProductRow => ({
  id: "prod-1",
  commercialName: "Tensivar",
  activeIngredient: "Losartán potásico",
  presentation: "Comprimidos recubiertos 50 mg x 30",
  category: "cardiovascular",
  priceClp: 6990,
  onHand: 40,
  lowStockThreshold: 5,
  ...overrides,
});

const rows = (count: number): CatalogProductRow[] =>
  Array.from({ length: count }, (_, index) => row({ id: `prod-${index + 1}` }));

const createRepo = (overrides: Partial<CatalogRepository> = {}): CatalogRepository => ({
  search: vi.fn(() => Promise.resolve([row()])),
  findActiveById: vi.fn(() => Promise.resolve(row())),
  ...overrides,
});

describe("catalog.service", () => {
  describe("toAvailability (CAT-U03, R-CAT-06)", () => {
    it.each([
      [0, 5, "out"],
      [1, 5, "low"],
      [5, 5, "low"],
      [6, 5, "available"],
      [0, 0, "out"],
      [1, 0, "available"],
      [-3, 5, "out"],
    ] as const)("%i units with threshold %i → %s", (qty, threshold, expected) => {
      expect(toAvailability(qty, threshold)).toBe(expected);
    });
  });

  describe("toProductSummary (R-CAT-07)", () => {
    it("exposes only public fields (no threshold, sku or stock internals)", () => {
      const summary = toProductSummary(row({ onHand: 3 }));
      expect(summary).toEqual({
        id: "prod-1",
        commercialName: "Tensivar",
        activeIngredient: "Losartán potásico",
        presentation: "Comprimidos recubiertos 50 mg x 30",
        category: "cardiovascular",
        priceClp: 6990,
        availableQty: 3,
        availability: "low",
      });
      expect(summary).not.toHaveProperty("lowStockThreshold");
      expect(summary).not.toHaveProperty("onHand");
    });
  });

  describe("search", () => {
    it("normalizes the term (accents, case, spaces) before querying (CAT-U01)", async () => {
      const repo = createRepo();
      const service = createCatalogService({ repo });

      await service.search({ q: "  LOSARTÁN   Potásico ", limit: 20 });

      expect(repo.search).toHaveBeenCalledWith({
        term: "losartan potasico",
        category: undefined,
        cursor: undefined,
        take: 21,
      });
    });

    it.each([undefined, "", "¿?¡!"])(
      "treats the term %j as an empty search (lists everything)",
      async (q) => {
        const repo = createRepo();
        await createCatalogService({ repo }).search({ q, limit: 20 });
        expect(repo.search).toHaveBeenCalledWith(expect.objectContaining({ term: undefined }));
      },
    );

    it("passes category and cursor through", async () => {
      const repo = createRepo();
      await createCatalogService({ repo }).search({
        q: "pregabalina",
        category: "salud-mental",
        cursor: "prod-9",
        limit: 5,
      });
      expect(repo.search).toHaveBeenCalledWith({
        term: "pregabalina",
        category: "salud-mental",
        cursor: "prod-9",
        take: 6,
      });
    });

    it("returns an empty page (not an error) when nothing matches (CAT-U04, HU-01 #2)", async () => {
      const service = createCatalogService({
        repo: createRepo({ search: () => Promise.resolve([]) }),
      });

      await expect(service.search({ q: "zzzz", limit: 20 })).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it("maps every row to its public summary with availability (CAT-U03)", async () => {
      const service = createCatalogService({
        repo: createRepo({
          search: () =>
            Promise.resolve([
              row({ id: "a", onHand: 0 }),
              row({ id: "b", onHand: 5 }),
              row({ id: "c", onHand: 6 }),
            ]),
        }),
      });

      const { items } = await service.search({ limit: 20 });

      expect(items.map((item) => [item.id, item.availableQty, item.availability])).toEqual([
        ["a", 0, "out"],
        ["b", 5, "low"],
        ["c", 6, "available"],
      ]);
    });

    describe("pagination (CAT-U05)", () => {
      it("returns nextCursor = last item id when there are more rows", async () => {
        const service = createCatalogService({
          repo: createRepo({ search: () => Promise.resolve(rows(4)) }),
        });

        const page = await service.search({ limit: 3 });

        expect(page.items.map((item) => item.id)).toEqual(["prod-1", "prod-2", "prod-3"]);
        expect(page.nextCursor).toBe("prod-3");
      });

      it("returns nextCursor = null on the last page (exactly `limit` rows)", async () => {
        const service = createCatalogService({
          repo: createRepo({ search: () => Promise.resolve(rows(3)) }),
        });

        const page = await service.search({ limit: 3 });

        expect(page.items).toHaveLength(3);
        expect(page.nextCursor).toBeNull();
      });
    });

    it("propagates unexpected repository failures", async () => {
      const failure = new Error("connection reset");
      const service = createCatalogService({
        repo: createRepo({ search: () => Promise.reject(failure) }),
      });

      await expect(service.search({ limit: 20 })).rejects.toBe(failure);
    });
  });

  describe("byId", () => {
    it("returns the public summary of an active product", async () => {
      const repo = createRepo();
      const service = createCatalogService({ repo });

      await expect(service.byId("prod-1")).resolves.toMatchObject({
        id: "prod-1",
        availability: "available",
        availableQty: 40,
      });
      expect(repo.findActiveById).toHaveBeenCalledWith("prod-1");
    });

    it("throws NOT_FOUND for a missing or inactive product (R-CAT-05)", async () => {
      const service = createCatalogService({
        repo: createRepo({ findActiveById: () => Promise.resolve(null) }),
      });

      const error = await service.byId("ghost").catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ code: "NOT_FOUND", message: PRODUCT_NOT_FOUND_MESSAGE });
    });
  });

  describe("createCatalogServiceFromDeps", () => {
    it("reads byId through the Prisma repository (active products only)", async () => {
      const { onHand, lowStockThreshold, ...product } = row();
      const findFirst = vi.fn(() =>
        Promise.resolve({ ...product, inventory: { onHand, lowStockThreshold } }),
      );
      const db = { product: { findFirst } } as unknown as Parameters<
        typeof createCatalogServiceFromDeps
      >[0]["db"];

      await expect(createCatalogServiceFromDeps({ db }).byId("prod-1")).resolves.toMatchObject({
        id: "prod-1",
        availableQty: 40,
      });
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "prod-1", active: true } }),
      );
    });

    it("treats a product without inventory row as out of stock", async () => {
      const { onHand: _onHand, lowStockThreshold: _threshold, ...product } = row();
      const findFirst = vi.fn(() => Promise.resolve({ ...product, inventory: null }));
      const db = { product: { findFirst } } as unknown as Parameters<
        typeof createCatalogServiceFromDeps
      >[0]["db"];

      await expect(createCatalogServiceFromDeps({ db }).byId("prod-1")).resolves.toMatchObject({
        availableQty: 0,
        availability: "out",
      });
    });
  });
});
