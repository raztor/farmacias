import {
  AppError,
  DEFAULT_LOW_STOCK_THRESHOLD,
  buildProductSearchText,
  noopLogger,
  normalizeSearchText,
  type AppLogger,
  type AuditAction,
  type ProductFields,
  type Role,
} from "@repo/shared";

import { isUniqueViolationError } from "../../lib/transactions";
import type { ApiDependencies } from "../../trpc";
import {
  createCatalogAdminRepository,
  type CatalogAdminRepository,
  type CatalogAdminUnitOfWork,
  type ProductWrite,
} from "./catalog-admin.repository";
import type {
  AdminListProductsQuery,
  AdminProduct,
  AdminProductList,
  CreateProductInput,
  UpdateProductInput,
} from "./catalog-admin.schema";

export const ADMIN_PRODUCT_NOT_FOUND_MESSAGE = "El producto no existe.";
export const PRODUCT_SKU_TAKEN_MESSAGE = "Ya existe un producto con ese SKU.";
export const PRODUCT_STALE_MESSAGE =
  "El producto cambió mientras lo editabas. Recarga para ver los cambios.";

/** Inventory row of a new product (R-CAT-14, D-28): no stock and the default threshold. */
export const NEW_PRODUCT_INVENTORY = {
  onHand: 0,
  lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
} as const;

export const PRODUCT_CREATE_AUDIT_ACTION = "product.create" satisfies AuditAction;
export const PRODUCT_UPDATE_AUDIT_ACTION = "product.update" satisfies AuditAction;

/** Admin performing the change (always `admin` behind `adminProcedure`), for the audit row. */
export type CatalogActor = { actorId: string; actorRole: Role };

export type CreateProductCommand = CreateProductInput & CatalogActor;
export type UpdateProductCommand = UpdateProductInput & CatalogActor;

export type CatalogAdminServiceDeps = {
  repo: CatalogAdminRepository;
  logger?: AppLogger;
};

export type CatalogAdminService = {
  list: (query: AdminListProductsQuery) => Promise<AdminProductList>;
  /** Any product, active or not. Missing: NOT_FOUND. */
  byId: (id: string) => Promise<AdminProduct>;
  /** Duplicate SKU: CONFLICT. */
  create: (command: CreateProductCommand) => Promise<AdminProduct>;
  /** Missing: NOT_FOUND. Duplicate SKU: CONFLICT. Nothing changed: no write, no audit row. */
  update: (command: UpdateProductCommand) => Promise<AdminProduct>;
};

/** Audit snapshot of a product (R-CAT-16): the editable fields, synthetic data only. */
export const toProductSnapshot = (product: ProductFields) => ({
  sku: product.sku,
  commercialName: product.commercialName,
  activeIngredient: product.activeIngredient,
  presentation: product.presentation,
  category: product.category,
  priceClp: product.priceClp,
  active: product.active,
});

const sameFields = (left: ProductFields, right: ProductFields): boolean => {
  const a = toProductSnapshot(left);
  const b = toProductSnapshot(right);
  return (Object.keys(a) as (keyof typeof a)[]).every((key) => a[key] === b[key]);
};

/** Fields to store, with `search_text` recomputed like the seed does (R-CAT-02). */
const toWrite = (fields: ProductFields): ProductWrite => ({
  ...toProductSnapshot(fields),
  searchText: buildProductSearchText(fields),
});

/** Maps a unique violation (only `products.sku` is unique among the written columns). */
const withSkuConflict = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueViolationError(error)) throw new AppError("CONFLICT", PRODUCT_SKU_TAKEN_MESSAGE);
    throw error;
  }
};

const notFound = () => new AppError("NOT_FOUND", ADMIN_PRODUCT_NOT_FOUND_MESSAGE);

/** Inserts the product with its initial inventory and its `product.create` audit row. */
const insertProduct = async (
  { products, audit }: CatalogAdminUnitOfWork,
  { actorId, actorRole, ...fields }: CreateProductCommand,
): Promise<AdminProduct> => {
  const created = await products.insert({ ...toWrite(fields), inventory: NEW_PRODUCT_INVENTORY });
  await audit.record([
    {
      actorId,
      actorRole,
      action: PRODUCT_CREATE_AUDIT_ACTION,
      entityType: "product",
      entityId: created.id,
      before: null,
      after: toProductSnapshot(created),
    },
  ]);
  return created;
};

/**
 * Locks the product, writes the new fields and the `product.update` audit row (before / after).
 * Someone else saved since the admin loaded it (`updatedAt` differs): CONFLICT, nothing written.
 * A save without changes writes nothing.
 */
const updateProduct = async (
  { products, audit }: CatalogAdminUnitOfWork,
  { actorId, actorRole, id, expectedUpdatedAt, ...fields }: UpdateProductCommand,
): Promise<AdminProduct> => {
  const current = await products.lockById(id);
  if (!current) throw notFound();
  if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    throw new AppError("CONFLICT", PRODUCT_STALE_MESSAGE);
  }
  if (sameFields(current, fields)) return current;
  const updated = await products.update(id, toWrite(fields));
  await audit.record([
    {
      actorId,
      actorRole,
      action: PRODUCT_UPDATE_AUDIT_ACTION,
      entityType: "product",
      entityId: id,
      before: toProductSnapshot(current),
      after: toProductSnapshot(updated),
    },
  ]);
  return updated;
};

export const createCatalogAdminService = ({
  repo,
  logger = noopLogger,
}: CatalogAdminServiceDeps): CatalogAdminService => ({
  list: async ({ q, status, cursor, limit }) => {
    const term = q === undefined ? "" : normalizeSearchText(q);
    const words = [...new Set(term.split(" ").filter((word) => word.length > 0))];
    const rows = await repo.list({ words, status, cursor, take: limit + 1 });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  },

  byId: async (id) => {
    const product = await repo.findById(id);
    if (!product) throw notFound();
    return product;
  },

  create: async (command) => {
    const product = await withSkuConflict(() =>
      repo.transaction((uow) => insertProduct(uow, command)),
    );
    logger.info({ actorId: command.actorId, productId: product.id }, "Product created");
    return product;
  },

  update: async (command) => {
    const product = await withSkuConflict(() =>
      repo.transaction((uow) => updateProduct(uow, command)),
    );
    logger.info({ actorId: command.actorId, productId: product.id }, "Product updated");
    return product;
  },
});

/** Wires the service to its Prisma repository and the request logger. */
export const createCatalogAdminServiceFromDeps = (
  deps: Pick<ApiDependencies, "db">,
  logger: AppLogger,
): CatalogAdminService =>
  createCatalogAdminService({ repo: createCatalogAdminRepository(deps.db), logger });
