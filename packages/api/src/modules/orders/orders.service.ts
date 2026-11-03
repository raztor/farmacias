import { noopLogger, ORDER_LINE_MAX_QUANTITY, type AppLogger } from "@repo/shared";

import { retryOnUniqueViolation } from "../../lib/transactions";
import type { ApiDependencies } from "../../trpc";
import { createCheckoutService, type CheckoutService } from "./order-checkout.service";
import { createTransitionRunner } from "./order-transition.repository";
import {
  createOrderTransitionService,
  type OrderTransitionService,
} from "./order-transition.service";
import { lineTotalClp, orderTotalClp } from "./order-totals";
import { toOrderDraft } from "./order-views";
import {
  draftNotFoundError,
  lineNotFoundError,
  productNotFoundError,
  quantityExceedsError,
} from "./orders.errors";
import {
  createOrdersRepository,
  type DraftRecord,
  type OrdersRepository,
  type OrdersTx,
  type ProductStock,
} from "./orders.repository";
import type {
  AddItemInput,
  OrderDraft,
  RemoveItemInput,
  SetFulfillmentInput,
  SetQuantityInput,
} from "./orders.schema";

/** The acting resident (always the owner: every operation targets their own draft). */
type ResidentCommand<T> = T & { residentId: string };

export type DraftService = {
  /** The resident's cart, or `null` when there is none. */
  draft: (residentId: string) => Promise<OrderDraft | null>;
  addItem: (command: ResidentCommand<AddItemInput>) => Promise<OrderDraft>;
  setQuantity: (command: ResidentCommand<SetQuantityInput>) => Promise<OrderDraft>;
  removeItem: (command: ResidentCommand<RemoveItemInput>) => Promise<OrderDraft>;
  setFulfillment: (command: ResidentCommand<SetFulfillmentInput>) => Promise<OrderDraft>;
};

export type OrdersService = DraftService & CheckoutService;

export type OrdersServiceDeps = { repo: OrdersRepository; logger?: AppLogger };

/** Units a line may hold: what is on hand, capped at 99 per line (R-ORD-03). */
export const maxLineQuantity = (product: Pick<ProductStock, "onHand">): number =>
  Math.max(0, Math.min(product.onHand, ORDER_LINE_MAX_QUANTITY));

const findActiveProduct = async (tx: OrdersTx, productId: string): Promise<ProductStock> => {
  const product = await tx.findProduct(productId);
  if (!product?.active) throw productNotFoundError();
  return product;
};

/** HU-03 #2: rejects `quantity` above availability, reporting the maximum still allowed. */
const assertAvailable = (product: ProductStock, quantity: number, inDraft: number): void => {
  const max = maxLineQuantity(product);
  if (quantity <= max) return;
  throw quantityExceedsError({
    productId: product.id,
    commercialName: product.commercialName,
    maxAllowed: Math.max(0, max - inDraft),
    inDraft,
  });
};

/** Writes one line with the current price snapshot, then the new total and version. */
const writeLine = async (
  tx: OrdersTx,
  draft: DraftRecord,
  product: ProductStock,
  quantity: number,
): Promise<OrderDraft> => {
  const line = { quantity, unitPriceClp: product.priceClp };
  await tx.saveLine({
    orderId: draft.id,
    productId: product.id,
    ...line,
    lineTotalClp: lineTotalClp(line),
  });
  const others = draft.lines.filter((existing) => existing.productId !== product.id);
  await tx.updateDraft(draft.id, { totalClp: orderTotalClp([...others, line]) });
  return toOrderDraft(await tx.loadDraft(draft.id));
};

const requireDraft = async (tx: OrdersTx, residentId: string): Promise<DraftRecord> => {
  const draft = await tx.lockDraft(residentId);
  if (!draft) throw draftNotFoundError();
  return draft;
};

const createDraftService = ({ repo }: OrdersServiceDeps): DraftService => ({
  draft: async (residentId) => {
    const draft = await repo.findDraft(residentId);
    return draft ? toOrderDraft(draft) : null;
  },

  // Two concurrent first additions race to create the draft: the loser hits the unique index
  // (one draft per resident) and is retried once, finding the winner's draft (R-ORD-01).
  addItem: ({ residentId, productId, quantity }) =>
    retryOnUniqueViolation(() =>
      repo.transaction(async (tx) => {
        const product = await findActiveProduct(tx, productId);
        const draft = (await tx.lockDraft(residentId)) ?? (await tx.createDraft(residentId));
        const inDraft = draft.lines.find((line) => line.productId === productId)?.quantity ?? 0;
        assertAvailable(product, inDraft + quantity, inDraft);
        return writeLine(tx, draft, product, inDraft + quantity);
      }),
    ),

  setQuantity: ({ residentId, productId, quantity }) =>
    repo.transaction(async (tx) => {
      const draft = await requireDraft(tx, residentId);
      if (!draft.lines.some((line) => line.productId === productId)) throw lineNotFoundError();
      const product = await findActiveProduct(tx, productId);
      assertAvailable(product, quantity, 0);
      return writeLine(tx, draft, product, quantity);
    }),

  removeItem: ({ residentId, productId }) =>
    repo.transaction(async (tx) => {
      const draft = await requireDraft(tx, residentId);
      if (!(await tx.deleteLine(draft.id, productId))) throw lineNotFoundError();
      const remaining = draft.lines.filter((line) => line.productId !== productId);
      await tx.updateDraft(draft.id, { totalClp: orderTotalClp(remaining) });
      return toOrderDraft(await tx.loadDraft(draft.id));
    }),

  // HU-04: pickup stores no address (#1); delivery data was validated by the schema (#2).
  setFulfillment: ({ residentId, ...fulfillment }) =>
    repo.transaction(async (tx) => {
      const draft = await requireDraft(tx, residentId);
      await tx.updateDraft(draft.id, { totalClp: draft.totalClp, fulfillment });
      return toOrderDraft(await tx.loadDraft(draft.id));
    }),
});

export const createOrdersService = (deps: OrdersServiceDeps): OrdersService => ({
  ...createDraftService(deps),
  ...createCheckoutService({ repo: deps.repo, logger: deps.logger ?? noopLogger }),
});

/** Wires the service to its Prisma repository and the request logger. */
export const createOrdersServiceFromDeps = (
  deps: Pick<ApiDependencies, "db">,
  logger: AppLogger,
): OrdersService => createOrdersService({ repo: createOrdersRepository(deps.db), logger });

/** Generic transition service (back office, seed) wired to Prisma. */
export const createOrderTransitionServiceFromDeps = (
  deps: Pick<ApiDependencies, "db">,
): OrderTransitionService =>
  createOrderTransitionService({ runner: createTransitionRunner(deps.db) });
