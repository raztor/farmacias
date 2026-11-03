import type { OrderStatus } from "@repo/shared";
import { z } from "zod";

import { PAYMENT_SCENARIOS, type ChargeOutcome } from "./payment-gateway";

/**
 * Input of `payments.pay` (HU-05). The client generates `idempotencyKey` (UUID) once per attempt
 * and reuses it when retrying that same attempt (R-PAY-04). Amounts never come from the client.
 */
export const payInput = z.object({
  orderId: z
    .string({ error: "Selecciona un pedido" })
    .trim()
    .min(1, { error: "Selecciona un pedido" })
    .max(64, { error: "Selecciona un pedido" }),
  idempotencyKey: z.uuid({ error: "La clave del intento de pago no es válida" }),
  scenario: z.enum(PAYMENT_SCENARIOS, {
    error: "Elige «Simular pago aprobado» o «Simular pago rechazado»",
  }),
});
export type PayInput = z.output<typeof payInput>;

export type PaymentResult = {
  paymentId: string;
  outcome: ChargeOutcome;
  reference: string;
  /** `true` when a stored result was returned without side effects (R-PAY-04/05). */
  replayed: boolean;
  /** What happened and how to continue, in Spanish (RNF-09). */
  message: string;
  order: {
    id: string;
    code: string;
    status: OrderStatus;
    statusLabel: string;
    version: number;
  };
};

/** Product that could not be discounted (details of CONFLICT `STOCK_CONFLICT`). */
export type StockConflictProduct = {
  productId: string;
  commercialName: string;
  requested: number;
  available: number;
};

/** Shape of the `payment.stock_conflict` audit evidence (read back on a replayed key). */
export const stockConflictEvidenceSchema = z.object({
  paymentId: z.string(),
  products: z.array(
    z.object({
      productId: z.string(),
      commercialName: z.string(),
      requested: z.number().int(),
      available: z.number().int(),
    }),
  ),
});
