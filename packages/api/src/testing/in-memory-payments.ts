import type { PaymentStatus } from "@repo/shared";

import type { StockConflictProduct } from "../modules/payments";
import type { PaymentsRepository, PaymentsTx } from "../modules/payments/payments.repository";
import { uniqueViolation, type InMemoryOrdering } from "./in-memory-ordering";

/** Payments double over {@link InMemoryOrdering} (same rollback-on-throw transactions). */

const conflictProductsOf = (after: unknown): StockConflictProduct[] => {
  if (typeof after !== "object" || after === null || !("products" in after)) return [];
  return Array.isArray(after.products) ? (after.products as StockConflictProduct[]) : [];
};

const paymentIdOf = (after: unknown): unknown =>
  typeof after === "object" && after !== null && "paymentId" in after ? after.paymentId : null;

const createPaymentsTx = (mem: InMemoryOrdering): PaymentsTx => ({
  ...mem.transitionDeps(),
  findPaymentByKey: (key) =>
    Promise.resolve(mem.state.payments.find((p) => p.idempotencyKey === key) ?? null),
  findApprovedPayment: (orderId) =>
    Promise.resolve(
      mem.state.payments.find((p) => p.orderId === orderId && p.status === "approved") ?? null,
    ),
  listLines: (orderId) =>
    Promise.resolve(
      mem.linesOf(orderId).map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        commercialName: mem.product(line.productId).commercialName,
      })),
    ),
  insertPayment: (payment) => {
    if (mem.state.payments.some((p) => p.idempotencyKey === payment.idempotencyKey)) {
      return Promise.reject(uniqueViolation());
    }
    const row = { ...payment, id: mem.nextId("payment"), failureReason: null };
    mem.state.payments.push(row);
    return Promise.resolve(row);
  },
  markStockConflict: (paymentId) => {
    const payment = mem.state.payments.find((p) => p.id === paymentId);
    if (payment) {
      payment.status = "stock_conflict" satisfies PaymentStatus;
      payment.failureReason = "STOCK_CONFLICT";
    }
    return Promise.resolve();
  },
  findStockConflictEvidence: (_orderId, paymentId) => {
    const row = mem.state.audit.find(
      (entry) =>
        entry.action === "payment.stock_conflict" && paymentIdOf(entry.after) === paymentId,
    );
    return Promise.resolve(conflictProductsOf(row?.after));
  },
});

export const createInMemoryPaymentsRepository = (mem: InMemoryOrdering): PaymentsRepository => ({
  transaction: (run) => mem.inTransaction(() => run(createPaymentsTx(mem))),
});
