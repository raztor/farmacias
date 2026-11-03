import { noopLogger, type AppLogger } from "@repo/shared";

import { retryOnUniqueViolation } from "../../lib/transactions";
import type { ApiDependencies } from "../../trpc";
import { discountForOrder, type StockConflict } from "../inventory";
import { isPaidStatus, isPayableStatus, statusLabel } from "../order-status";
import {
  applyTransition,
  orderNotFoundError,
  type OrderRef,
  type TransitionActor,
} from "../orders";
import type { ChargeResult, PaymentGateway } from "./payment-gateway";
import {
  REJECTED_MESSAGE,
  approvedMessage,
  idempotencyKeyReusedError,
  orderNotPayableError,
  stockConflictError,
} from "./payments.errors";
import {
  createPaymentsRepository,
  type PayableLine,
  type PaymentRecord,
  type PaymentsRepository,
  type PaymentsTx,
} from "./payments.repository";
import type { PayInput, PaymentResult, StockConflictProduct } from "./payments.schema";
import { createSimulatedPaymentGateway } from "./simulated-payment-gateway";

export type PayCommand = PayInput & { residentId: string };

export type PaymentsService = {
  /** HU-05/HU-06: idempotent simulated payment of the resident's own order. */
  pay: (command: PayCommand) => Promise<PaymentResult>;
};

export type PaymentsServiceDeps = {
  repo: PaymentsRepository;
  gateway: PaymentGateway;
  logger?: AppLogger;
};

/** Payment results are recorded by the system actor (D-03); no personal data. */
const SYSTEM: TransitionActor = { id: null, role: "system" };

type TxOutcome =
  | { kind: "result"; result: PaymentResult }
  | { kind: "stock_conflict"; products: StockConflictProduct[] };

const toResult = (payment: PaymentRecord, order: OrderRef, replayed: boolean): TxOutcome => {
  const outcome = payment.status === "approved" ? "approved" : "rejected";
  return {
    kind: "result",
    result: {
      paymentId: payment.id,
      outcome,
      reference: payment.reference ?? "",
      replayed,
      message: outcome === "approved" ? approvedMessage(order.code) : REJECTED_MESSAGE,
      order: {
        id: order.id,
        code: order.code,
        status: order.status,
        statusLabel: statusLabel(order.status),
        version: order.version,
      },
    },
  };
};

/** R-PAY-04/R-PAY-10: a known key returns its stored result, with no side effect. */
const replayAttempt = async (
  tx: PaymentsTx,
  order: OrderRef,
  payment: PaymentRecord,
): Promise<TxOutcome> => {
  if (payment.orderId !== order.id) throw idempotencyKeyReusedError();
  if (payment.status === "stock_conflict") {
    return {
      kind: "stock_conflict",
      products: await tx.findStockConflictEvidence(order.id, payment.id),
    };
  }
  return toResult(payment, order, true);
};

/** R-PAY-05: an already paid order returns its approved payment, never a second discount. */
const replayApproved = async (tx: PaymentsTx, order: OrderRef): Promise<TxOutcome> => {
  const approved = await tx.findApprovedPayment(order.id);
  if (!approved) throw orderNotPayableError(order.status);
  return toResult(approved, order, true);
};

const withNames = (
  conflicts: readonly StockConflict[],
  lines: readonly PayableLine[],
): StockConflictProduct[] =>
  conflicts.map((conflict) => ({
    ...conflict,
    commercialName:
      lines.find((line) => line.productId === conflict.productId)?.commercialName ?? "",
  }));

type Attempt = { order: OrderRef; charge: ChargeResult; idempotencyKey: string };

/**
 * R-PAY-06/R-PAY-09: records the approved payment, discounts every line atomically and
 * validates the order. If a line lacks stock, nothing is discounted: the attempt is kept as
 * `stock_conflict` with its audit evidence and the order keeps its status.
 */
const settleApproved = async (
  tx: PaymentsTx,
  { order, charge, idempotencyKey }: Attempt,
): Promise<TxOutcome> => {
  const payment = await tx.insertPayment({
    orderId: order.id,
    idempotencyKey,
    amountClp: order.totalClp,
    status: "approved",
    reference: charge.reference,
  });
  const lines = await tx.listLines(order.id);
  const discount = await discountForOrder(
    { store: tx.inventory, audit: tx.audit },
    {
      orderId: order.id,
      paymentId: payment.id,
      lines,
      actor: { actorId: null, actorRole: "system" },
    },
  );
  if (!discount.ok) {
    const products = withNames(discount.conflicts, lines);
    await tx.markStockConflict(payment.id);
    await tx.audit.record([
      {
        actorId: null,
        actorRole: "system",
        action: "payment.stock_conflict",
        entityType: "order",
        entityId: order.id,
        after: { paymentId: payment.id, products },
      },
    ]);
    return { kind: "stock_conflict", products };
  }
  const applied = await applyTransition(tx, {
    order,
    to: "payment_validated",
    actor: SYSTEM,
    expectedVersion: order.version,
    stockDiscounted: true,
  });
  return toResult(payment, applied.order, false);
};

/** R-PAY-07: records the rejection; the stock is never touched. */
const settleRejected = async (
  tx: PaymentsTx,
  { order, charge, idempotencyKey }: Attempt,
): Promise<TxOutcome> => {
  const payment = await tx.insertPayment({
    orderId: order.id,
    idempotencyKey,
    amountClp: order.totalClp,
    status: "rejected",
    reference: charge.reference,
  });
  const applied = await applyTransition(tx, {
    order,
    to: "payment_rejected",
    actor: SYSTEM,
    expectedVersion: order.version,
  });
  return toResult(payment, applied.order, false);
};

/**
 * One database transaction per attempt. The order row is locked first, so attempts on the same
 * order (duplicates included) run one after the other and see each other's results; inventory
 * rows are then locked in product order, so attempts on different orders never deadlock.
 */
const payInTransaction = async (
  tx: PaymentsTx,
  gateway: PaymentGateway,
  command: PayCommand,
): Promise<TxOutcome> => {
  const order = await tx.transitions.lockOrder(command.orderId);
  if (order?.residentId !== command.residentId) throw orderNotFoundError();
  const existing = await tx.findPaymentByKey(command.idempotencyKey);
  if (existing) return replayAttempt(tx, order, existing);
  if (isPaidStatus(order.status)) return replayApproved(tx, order);
  if (!isPayableStatus(order.status)) throw orderNotPayableError(order.status);

  const charge = await gateway.charge({
    orderId: order.id,
    amountClp: order.totalClp,
    idempotencyKey: command.idempotencyKey,
    scenario: command.scenario,
  });
  const attempt = { order, charge, idempotencyKey: command.idempotencyKey };
  return charge.outcome === "approved" ? settleApproved(tx, attempt) : settleRejected(tx, attempt);
};

export const createPaymentsService = ({
  repo,
  gateway,
  logger = noopLogger,
}: PaymentsServiceDeps): PaymentsService => ({
  pay: async (command) => {
    // A concurrent duplicate key for another order loses on the unique index; the retry then
    // sees the committed row and answers IDEMPOTENCY_KEY_REUSED (or the stored result).
    const outcome = await retryOnUniqueViolation(() =>
      repo.transaction((tx) => payInTransaction(tx, gateway, command)),
    );
    if (outcome.kind === "stock_conflict") {
      logger.warn(
        { orderId: command.orderId, products: outcome.products },
        "Payment stock conflict",
      );
      throw stockConflictError(outcome.products);
    }
    const { result } = outcome;
    logger.info(
      { orderId: result.order.id, outcome: result.outcome, replayed: result.replayed },
      "Simulated payment processed",
    );
    return result;
  },
});

/** Wires the service to Prisma and the simulated gateway (the MVP adapter of the port). */
export const createPaymentsServiceFromDeps = (
  deps: Pick<ApiDependencies, "db">,
  logger: AppLogger,
): PaymentsService =>
  createPaymentsService({
    repo: createPaymentsRepository(deps.db),
    gateway: createSimulatedPaymentGateway(),
    logger,
  });
