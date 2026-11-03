import type { PaymentResult } from "@repo/api";
import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { GENERIC_ERROR_MESSAGE } from "../../lib/error-message";
import {
  UNKNOWN_OUTCOME_MESSAGE,
  keepsAttemptKey,
  outcomeFromError,
  outcomeFromResult,
} from "./payment-outcome";

function apiError(message: string, data: Record<string, unknown>) {
  return TRPCClientError.from({ error: { message, code: -32_600, data } });
}

const conflict = (message: string, reason?: string) =>
  apiError(message, { code: "CONFLICT", httpStatus: 409, ...(reason ? { reason } : {}) });

function result(outcome: "approved" | "rejected", replayed = false): PaymentResult {
  return {
    paymentId: "pay-1",
    outcome,
    reference: "SIM-123",
    replayed,
    message: outcome === "approved" ? "Pago simulado aprobado." : "Tu pago simulado fue rechazado.",
    order: {
      id: "order-1",
      code: "P-000001",
      status: outcome === "approved" ? "payment_validated" : "payment_rejected",
      statusLabel: outcome === "approved" ? "Pago validado" : "Pago rechazado",
      version: 2,
    },
  };
}

describe("outcomeFromResult", () => {
  it("shows the approval with the API message (HU-05 #1)", () => {
    expect(outcomeFromResult(result("approved"))).toEqual({
      kind: "approved",
      message: "Pago simulado aprobado.",
      replayed: false,
    });
  });

  it("shows the rejection (HU-05 #2)", () => {
    expect(outcomeFromResult(result("rejected")).kind).toBe("rejected");
  });

  it("keeps the stored result of a repeated request (HU-05 #3)", () => {
    expect(outcomeFromResult(result("approved", true))).toMatchObject({ replayed: true });
  });
});

describe("outcomeFromError", () => {
  it("detects a stock conflict by reason or by message (HU-06 #2)", () => {
    const text = "No hay stock suficiente de: Losartán. Tu pedido sigue pendiente.";

    expect(outcomeFromError(conflict(text, "STOCK_CONFLICT"))).toEqual({
      kind: "stock_conflict",
      message: text,
    });
    expect(outcomeFromError(conflict(text)).kind).toBe("stock_conflict");
  });

  it("detects an order that no longer accepts payments", () => {
    const text = "Este pedido está en «Cancelado» y no admite pagos.";

    expect(outcomeFromError(conflict(text)).kind).toBe("not_payable");
    expect(outcomeFromError(conflict("Otro texto", "ORDER_NOT_PAYABLE")).kind).toBe("not_payable");
  });

  it("treats other definitive errors as failed, with the API message", () => {
    const notFound = apiError("No encontramos ese pedido.", { code: "NOT_FOUND", httpStatus: 404 });

    expect(outcomeFromError(notFound)).toEqual({
      kind: "failed",
      message: "No encontramos ese pedido.",
    });
    expect(outcomeFromError(conflict("Este intento de pago ya se usó en otro pedido.")).kind).toBe(
      "failed",
    );
  });

  it("marks network and server errors as unknown so the same key is retried", () => {
    const network = outcomeFromError(TRPCClientError.from(new TypeError("Network request failed")));
    const server = outcomeFromError(
      apiError("x", { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 }),
    );

    expect(network).toEqual({ kind: "unknown", message: UNKNOWN_OUTCOME_MESSAGE });
    expect(server.kind).toBe("unknown");
    expect(server.message).not.toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe("keepsAttemptKey", () => {
  it("keeps the key only while the outcome is unknown", () => {
    expect(keepsAttemptKey({ kind: "unknown", message: "" })).toBe(true);
    for (const kind of ["stock_conflict", "not_payable", "failed"] as const) {
      expect(keepsAttemptKey({ kind, message: "" })).toBe(false);
    }
    expect(keepsAttemptKey(outcomeFromResult(result("approved")))).toBe(false);
    expect(keepsAttemptKey(outcomeFromResult(result("rejected")))).toBe(false);
  });
});
