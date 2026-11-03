import { AppError, type OrderStatus } from "@repo/shared";

import { statusLabel } from "../order-status";
import type { StockConflictProduct } from "./payments.schema";

export const approvedMessage = (code: string): string =>
  `Pago simulado aprobado. Tu pedido ${code} quedó en «Pago validado» y pronto comenzará su preparación.`;

export const REJECTED_MESSAGE =
  "Tu pago simulado fue rechazado. Puedes intentarlo de nuevo o cancelar el pedido.";

/** R-PAY-02: drafts, cancelled orders… cannot be paid. */
export const orderNotPayableError = (status: OrderStatus): AppError =>
  new AppError(
    "CONFLICT",
    `Este pedido está en «${statusLabel(status)}» y no admite pagos. Revisa su estado en «Mis pedidos».`,
    { details: { reason: "ORDER_NOT_PAYABLE", status } },
  );

/** R-PAY-04: the key already belongs to another order's attempt. */
export const idempotencyKeyReusedError = (): AppError =>
  new AppError(
    "CONFLICT",
    "Este intento de pago ya se usó en otro pedido. Vuelve a intentarlo desde tu pedido.",
    { details: { reason: "IDEMPOTENCY_KEY_REUSED" } },
  );

/** R-PAY-09 (HU-06 #2): the order keeps its status; nothing was discounted. */
export const stockConflictError = (products: readonly StockConflictProduct[]): AppError => {
  const names = products.map((product) => product.commercialName).join(", ");
  return new AppError(
    "CONFLICT",
    `No hay stock suficiente de: ${names || "algunos productos"}. ` +
      "Tu pedido sigue pendiente; puedes intentarlo más tarde o cancelarlo.",
    { details: { reason: "STOCK_CONFLICT", products } },
  );
};
