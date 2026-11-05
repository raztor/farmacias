import { TRPCError, type TRPCDefaultErrorShape } from "@trpc/server";
import { AppError, updateProfileSchema } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { formatError } from "./error-formatter";
import { INTERNAL_ERROR_MESSAGE } from "./error-mapping";

const shapeFor = (error: TRPCError): TRPCDefaultErrorShape => ({
  message: error.message,
  code: -32600,
  data: { code: error.code, httpStatus: 400, path: "user.updateProfile" },
});

describe("formatError", () => {
  it("adds the zod error tree and the first issue message to validation errors", () => {
    const parsed = updateProfileSchema.safeParse({ name: "" });
    if (parsed.success) throw new Error("expected invalid input");
    const error = new TRPCError({ code: "BAD_REQUEST", cause: parsed.error });

    const formatted = formatError({ shape: shapeFor(error), error });

    expect(formatted.message).toBe("Ingresa tu nombre");
    expect(formatted.data.zodError?.properties?.name?.errors).toEqual(["Ingresa tu nombre"]);
    expect(formatted.data.path).toBe("user.updateProfile");
  });

  it("sets zodError to null for other errors", () => {
    const error = new TRPCError({ code: "BAD_REQUEST", message: "Solicitud inválida" });

    const formatted = formatError({ shape: shapeFor(error), error });

    expect(formatted.message).toBe("Solicitud inválida");
    expect(formatted.data.zodError).toBeNull();
  });

  it("exposes the domain reason of a business error, and only the reason", () => {
    const cause = new AppError("CONFLICT", "No hay stock suficiente.", {
      details: { reason: "STOCK_CONFLICT", products: [{ productId: "p-1" }] },
    });
    const error = new TRPCError({ code: "CONFLICT", message: cause.message, cause });

    const formatted = formatError({ shape: shapeFor(error), error });

    expect(formatted.data.reason).toBe("STOCK_CONFLICT");
    expect(formatted.data).not.toHaveProperty("details");
  });

  it("sets reason to null without an AppError reason and for internal errors", () => {
    const plain = new TRPCError({ code: "CONFLICT", message: "Conflicto" });
    const withoutReason = new TRPCError({
      code: "NOT_FOUND",
      cause: new AppError("NOT_FOUND", "No encontrado", { details: { id: "x" } }),
    });
    const internal = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      cause: new AppError("INTERNAL", "boom", { details: { reason: "SECRET" } }),
    });

    for (const error of [plain, withoutReason, internal]) {
      expect(formatError({ shape: shapeFor(error), error }).data.reason).toBeNull();
    }
  });

  it("never exposes the message of internal errors", () => {
    const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "password=hunter2" });

    const formatted = formatError({ shape: shapeFor(error), error });

    expect(formatted.message).toBe(INTERNAL_ERROR_MESSAGE);
  });
});
