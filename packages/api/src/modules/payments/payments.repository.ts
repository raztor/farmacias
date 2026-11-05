import type { Prisma, PrismaClient } from "@repo/db";
import { isPaymentStatus, type PaymentStatus } from "@repo/shared";

import { INTERACTIVE_TRANSACTION_OPTIONS } from "../../lib/transactions";
import { createTransitionDeps, type TransitionDeps } from "../orders";
import { stockConflictEvidenceSchema, type StockConflictProduct } from "./payments.schema";

export type PaymentRecord = {
  id: string;
  orderId: string;
  amountClp: number;
  status: PaymentStatus;
  reference: string | null;
};

export type PaymentInsert = {
  orderId: string;
  idempotencyKey: string;
  amountClp: number;
  status: PaymentStatus;
  reference: string | null;
};

export type PayableLine = { productId: string; quantity: number; commercialName: string };

/** Payment data access bound to one transaction, plus the transition stores. */
export type PaymentsTx = TransitionDeps & {
  findPaymentByKey: (idempotencyKey: string) => Promise<PaymentRecord | null>;
  findApprovedPayment: (orderId: string) => Promise<PaymentRecord | null>;
  listLines: (orderId: string) => Promise<PayableLine[]>;
  insertPayment: (payment: PaymentInsert) => Promise<PaymentRecord>;
  markStockConflict: (paymentId: string) => Promise<void>;
  /** Products of the `payment.stock_conflict` audit row of that attempt. */
  findStockConflictEvidence: (
    orderId: string,
    paymentId: string,
  ) => Promise<StockConflictProduct[]>;
};

export type PaymentsRepository = {
  transaction: <T>(run: (tx: PaymentsTx) => Promise<T>) => Promise<T>;
};

const PAYMENT_SELECT = {
  id: true,
  orderId: true,
  amountClp: true,
  status: true,
  reference: true,
} satisfies Prisma.PaymentSelect;

const toRecord = (row: Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>) => {
  if (!isPaymentStatus(row.status)) throw new Error(`Unknown payment status "${row.status}"`);
  return { ...row, status: row.status };
};

const STOCK_CONFLICT_REASON = "STOCK_CONFLICT";

const createPaymentsTx = (tx: Prisma.TransactionClient): PaymentsTx => ({
  ...createTransitionDeps(tx),
  findPaymentByKey: async (idempotencyKey) => {
    const row = await tx.payment.findUnique({ where: { idempotencyKey }, select: PAYMENT_SELECT });
    return row ? toRecord(row) : null;
  },
  findApprovedPayment: async (orderId) => {
    const row = await tx.payment.findFirst({
      where: { orderId, status: "approved" },
      select: PAYMENT_SELECT,
    });
    return row ? toRecord(row) : null;
  },
  listLines: async (orderId) => {
    const rows = await tx.orderLine.findMany({
      where: { orderId },
      select: { productId: true, quantity: true, product: { select: { commercialName: true } } },
    });
    return rows.map(({ product, ...line }) => ({
      ...line,
      commercialName: product.commercialName,
    }));
  },
  insertPayment: async (payment) =>
    toRecord(await tx.payment.create({ data: { ...payment }, select: PAYMENT_SELECT })),
  markStockConflict: async (paymentId) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "stock_conflict", failureReason: STOCK_CONFLICT_REASON },
    });
  },
  findStockConflictEvidence: async (orderId, paymentId) => {
    const row = await tx.auditLog.findFirst({
      where: {
        action: "payment.stock_conflict",
        entityType: "order",
        entityId: orderId,
        after: { path: ["paymentId"], equals: paymentId },
      },
      select: { after: true },
    });
    const evidence = stockConflictEvidenceSchema.safeParse(row?.after);
    return evidence.success ? evidence.data.products : [];
  },
});

export const createPaymentsRepository = (db: PrismaClient): PaymentsRepository => ({
  transaction: (run) =>
    db.$transaction((tx) => run(createPaymentsTx(tx)), INTERACTIVE_TRANSACTION_OPTIONS),
});
