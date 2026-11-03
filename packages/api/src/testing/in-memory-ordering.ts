import type { FulfillmentType, OrderStatus } from "@repo/shared";

import type { AuditEntryInput, AuditWriter } from "../modules/audit";
import type { InventoryStore, StockMovementInput } from "../modules/inventory";
import type { OrderRef, StatusEventInput, TransitionStore } from "../modules/orders";
import type { DraftRecord, OrdersRepository, OrdersTx } from "../modules/orders/orders.repository";
import type { DeliveryDetails } from "../modules/orders/orders.schema";
import type { PaymentRecord } from "../modules/payments/payments.repository";

/**
 * In-memory double of the ordering tables for service unit tests (no database). A transaction
 * works on the live state and restores a snapshot when the callback throws, like a rollback.
 * Kept free of `vitest` imports.
 */

export type MemProduct = {
  id: string;
  commercialName: string;
  presentation: string;
  priceClp: number;
  active: boolean;
  onHand: number;
};

export type MemOrder = OrderRef & { delivery: DeliveryDetails | null };

export type MemLine = {
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceClp: number;
  lineTotalClp: number;
};

export type MemPayment = PaymentRecord & {
  idempotencyKey: string;
  failureReason: string | null;
};

export type MemState = {
  products: MemProduct[];
  orders: MemOrder[];
  lines: MemLine[];
  events: (StatusEventInput | { orderId: string; from: null; to: "draft" })[];
  payments: MemPayment[];
  audit: AuditEntryInput[];
  movements: StockMovementInput[];
  /** Product ids in the order `lockStock` locked them (asserts deterministic locking). */
  locks: string[][];
  sequence: number;
};

export const uniqueViolation = (): Error =>
  Object.assign(new Error("Unique violation"), { code: "P2002" });

const NOW = new Date("2026-11-03T12:00:00.000Z");

export class InMemoryOrdering {
  state: MemState = {
    products: [],
    orders: [],
    lines: [],
    events: [],
    payments: [],
    audit: [],
    movements: [],
    locks: [],
    sequence: 0,
  };

  nextId(prefix: string): string {
    this.state.sequence += 1;
    return `${prefix}-${String(this.state.sequence)}`;
  }

  addProduct(overrides: Partial<MemProduct> & { id: string }): MemProduct {
    const product = {
      commercialName: `Producto ${overrides.id}`,
      presentation: "Comprimidos x 30",
      priceClp: 1000,
      active: true,
      onHand: 10,
      ...overrides,
    };
    this.state.products.push(product);
    return product;
  }

  addOrder(overrides: Partial<MemOrder> & { id: string; residentId: string }): MemOrder {
    const order: MemOrder = {
      code: `P-${overrides.id}`,
      status: "draft",
      version: 0,
      fulfillment: null,
      delivery: null,
      totalClp: 0,
      updatedAt: NOW,
      ...overrides,
    };
    this.state.orders.push(order);
    return order;
  }

  addLine(line: Omit<MemLine, "lineTotalClp">): void {
    this.state.lines.push({ ...line, lineTotalClp: line.quantity * line.unitPriceClp });
  }

  product(id: string): MemProduct {
    const product = this.state.products.find((candidate) => candidate.id === id);
    if (!product) throw new Error(`no product ${id}`);
    return product;
  }

  order(id: string): MemOrder {
    const order = this.state.orders.find((candidate) => candidate.id === id);
    if (!order) throw new Error(`no order ${id}`);
    return order;
  }

  linesOf(orderId: string): MemLine[] {
    return this.state.lines.filter((line) => line.orderId === orderId);
  }

  async inTransaction<T>(run: () => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.state);
    try {
      return await run();
    } catch (error) {
      this.state = snapshot;
      throw error;
    }
  }

  // ---- inventory -----------------------------------------------------------------------------

  inventoryStore(): InventoryStore {
    return {
      lockStock: (ids) => {
        this.state.locks.push([...ids]);
        const rows = this.state.products
          .filter((product) => ids.includes(product.id))
          .map(({ id, onHand }) => ({ productId: id, onHand }))
          .sort((a, b) => (a.productId < b.productId ? -1 : 1));
        return Promise.resolve(rows);
      },
      decrement: ({ productId, quantity }) => {
        const product = this.state.products.find((candidate) => candidate.id === productId);
        if (!product || product.onHand < quantity) return Promise.resolve(null);
        product.onHand -= quantity;
        return Promise.resolve(product.onHand);
      },
      increment: ({ productId, quantity }) => {
        const product = this.state.products.find((candidate) => candidate.id === productId);
        if (!product) return Promise.resolve(null);
        product.onHand += quantity;
        return Promise.resolve(product.onHand);
      },
      insertMovements: (movements) => {
        this.state.movements.push(...movements);
        return Promise.resolve();
      },
      listOrderMovements: (orderId) =>
        Promise.resolve(this.state.movements.filter((movement) => movement.orderId === orderId)),
    };
  }

  auditWriter(): AuditWriter {
    return {
      record: (entries) => {
        this.state.audit.push(...entries);
        return Promise.resolve();
      },
    };
  }

  // ---- transitions ---------------------------------------------------------------------------

  private toRef(order: MemOrder): OrderRef {
    const { delivery: _delivery, ...ref } = order;
    return { ...ref };
  }

  transitionStore(): TransitionStore {
    return {
      lockOrder: (orderId) => {
        const order = this.state.orders.find((candidate) => candidate.id === orderId);
        return Promise.resolve(order ? this.toRef(order) : null);
      },
      compareAndSet: ({ orderId, from, to, expectedVersion, totalClp }) => {
        const order = this.state.orders.find((candidate) => candidate.id === orderId);
        if (order?.status !== from || order.version !== expectedVersion) {
          return Promise.resolve(null);
        }
        order.status = to;
        order.version += 1;
        if (totalClp !== undefined) order.totalClp = totalClp;
        return Promise.resolve(this.toRef(order));
      },
      insertEvent: (event) => {
        this.state.events.push(event);
        return Promise.resolve();
      },
    };
  }

  transitionDeps() {
    return {
      transitions: this.transitionStore(),
      audit: this.auditWriter(),
      inventory: this.inventoryStore(),
    };
  }

  transitionRunner() {
    return {
      transaction: <T>(run: (deps: ReturnType<InMemoryOrdering["transitionDeps"]>) => Promise<T>) =>
        this.inTransaction(() => run(this.transitionDeps())),
    };
  }

  // ---- orders --------------------------------------------------------------------------------

  private draftRecord(order: MemOrder): DraftRecord {
    return {
      id: order.id,
      code: order.code,
      residentId: order.residentId,
      version: order.version,
      totalClp: order.totalClp,
      fulfillment: order.fulfillment,
      delivery: order.delivery,
      lines: this.linesOf(order.id).map((line) => {
        const product = this.product(line.productId);
        return {
          ...line,
          commercialName: product.commercialName,
          presentation: product.presentation,
          currentPriceClp: product.priceClp,
          active: product.active,
          onHand: product.onHand,
        };
      }),
    };
  }

  private findDraft(residentId: string): MemOrder | undefined {
    return this.state.orders.find(
      (order) => order.residentId === residentId && order.status === "draft",
    );
  }

  private ordersTx(): OrdersTx {
    return {
      ...this.transitionDeps(),
      lockDraft: (residentId) => {
        const draft = this.findDraft(residentId);
        return Promise.resolve(draft ? this.draftRecord(draft) : null);
      },
      createDraft: (residentId) => {
        if (this.findDraft(residentId)) return Promise.reject(uniqueViolation());
        const order = this.addOrder({ id: this.nextId("order"), residentId });
        this.state.events.push({ orderId: order.id, from: null, to: "draft" });
        return Promise.resolve(this.draftRecord(order));
      },
      loadDraft: (orderId) => Promise.resolve(this.draftRecord(this.order(orderId))),
      findProduct: (productId) =>
        Promise.resolve(this.state.products.find((product) => product.id === productId) ?? null),
      saveLine: (line) => {
        this.state.lines = this.state.lines.filter(
          (existing) =>
            !(existing.orderId === line.orderId && existing.productId === line.productId),
        );
        this.state.lines.push(line);
        return Promise.resolve();
      },
      deleteLine: (orderId, productId) => {
        const before = this.state.lines.length;
        this.state.lines = this.state.lines.filter(
          (line) => !(line.orderId === orderId && line.productId === productId),
        );
        return Promise.resolve(this.state.lines.length < before);
      },
      updateDraft: (orderId, { totalClp, fulfillment }) => {
        const order = this.order(orderId);
        order.totalClp = totalClp;
        order.version += 1;
        if (fulfillment) {
          order.fulfillment = fulfillment.type;
          order.delivery = fulfillment.type === "delivery" ? toDelivery(fulfillment) : null;
        }
        return Promise.resolve();
      },
    };
  }

  ordersRepository(): OrdersRepository {
    return {
      transaction: (run) => this.inTransaction(() => run(this.ordersTx())),
      findDraft: (residentId) => {
        const draft = this.findDraft(residentId);
        return Promise.resolve(draft ? this.draftRecord(draft) : null);
      },
    };
  }

  /** Current status of an order (assertion helper). */
  statusOf(orderId: string): OrderStatus {
    return this.order(orderId).status;
  }
}

const toDelivery = (fulfillment: DeliveryDetails & { type: FulfillmentType }): DeliveryDetails => ({
  sector: fulfillment.sector,
  addressReference: fulfillment.addressReference,
  contactAlias: fulfillment.contactAlias,
  instructions: fulfillment.instructions,
});
