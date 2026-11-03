import { describe, expect, it } from "vitest";

import {
  ACTIONABLE_STATUSES,
  EMPTY_QUEUE_FILTERS,
  QUEUE_PAGE_SIZE,
  QUEUE_STATUS_OPTIONS,
  describeQueueFilters,
  hasActiveFilters,
  orderCodeError,
  parseQueueFilters,
  queueResultText,
  queueSearch,
  toQueueInput,
  type QueueFilters,
} from "./queue-filters";

describe("QUEUE_STATUS_OPTIONS", () => {
  it("offers every status except the private draft, in lifecycle order", () => {
    expect(QUEUE_STATUS_OPTIONS).toEqual([
      "pending_payment",
      "payment_validated",
      "payment_rejected",
      "in_preparation",
      "ready_for_pickup",
      "in_transit",
      "delivered",
      "not_delivered",
      "cancelled",
    ]);
  });

  it("'Por gestionar' only lists statuses with a pending physical action", () => {
    expect(ACTIONABLE_STATUSES.every((status) => QUEUE_STATUS_OPTIONS.includes(status))).toBe(true);
    expect(ACTIONABLE_STATUSES).not.toContain("delivered");
    expect(ACTIONABLE_STATUSES).not.toContain("cancelled");
  });
});

describe("parseQueueFilters", () => {
  it("reads statuses (canonical order, no duplicates), modality and code", () => {
    const parsed = parseQueueFilters({
      status: ["in_transit", "payment_validated", "in_transit"],
      fulfillment: "delivery",
      code: " p-0001 ",
    });

    expect(parsed.filters).toEqual({
      status: ["payment_validated", "in_transit"],
      fulfillment: "delivery",
      code: "P-0001",
    });
    expect(parsed.codeError).toBeNull();
  });

  it("ignores unknown values and the private draft status", () => {
    const parsed = parseQueueFilters({ status: ["draft", "shipped"], fulfillment: "courier" });

    expect(parsed.filters).toEqual(EMPTY_QUEUE_FILTERS);
  });

  it("treats blank parameters (an empty GET form) as no filter", () => {
    expect(parseQueueFilters({ fulfillment: "", code: "" }).filters).toEqual(EMPTY_QUEUE_FILTERS);
  });

  it("reports an invalid code and does not search with it", () => {
    const parsed = parseQueueFilters({ code: "P-1%" });

    expect(parsed.filters.code).toBe("");
    expect(parsed.codeInput).toBe("P-1%");
    expect(parsed.codeError).toMatch(/letras, números y guiones/);
  });
});

describe("orderCodeError", () => {
  it("accepts codes and prefixes up to 20 characters", () => {
    expect(orderCodeError("")).toBeNull();
    expect(orderCodeError("P-000123")).toBeNull();
    expect(orderCodeError("P".repeat(20))).toBeNull();
    expect(orderCodeError("P".repeat(21))).toBe("El código admite hasta 20 caracteres.");
  });
});

describe("filters ↔ URL", () => {
  const filters: QueueFilters = {
    status: ["ready_for_pickup", "payment_validated"],
    fulfillment: "pickup",
    code: "P-00",
  };

  it("serializes in a stable order", () => {
    expect(queueSearch(filters)).toBe(
      "?status=payment_validated&status=ready_for_pickup&fulfillment=pickup&code=P-00",
    );
    expect(queueSearch(EMPTY_QUEUE_FILTERS)).toBe("");
  });

  it("round-trips through the URL", () => {
    const params = Object.fromEntries(
      [...new URLSearchParams(queueSearch(filters)).keys()].map((key) => [
        key,
        new URLSearchParams(queueSearch(filters)).getAll(key),
      ]),
    );

    expect(parseQueueFilters(params).filters).toEqual({
      ...filters,
      status: ["payment_validated", "ready_for_pickup"],
    });
  });
});

describe("toQueueInput", () => {
  it("sends only the active filters", () => {
    expect(toQueueInput(EMPTY_QUEUE_FILTERS)).toEqual({ limit: QUEUE_PAGE_SIZE });
    expect(
      toQueueInput({ status: ["in_transit"], fulfillment: "delivery", code: "P-000001" }),
    ).toEqual({
      limit: QUEUE_PAGE_SIZE,
      status: ["in_transit"],
      fulfillment: "delivery",
      q: "P-000001",
    });
  });
});

describe("hasActiveFilters / describeQueueFilters", () => {
  it("describes the filters in Spanish", () => {
    expect(hasActiveFilters(EMPTY_QUEUE_FILTERS)).toBe(false);
    expect(describeQueueFilters(EMPTY_QUEUE_FILTERS)).toBe("Sin filtros: todos los pedidos.");

    const filters: QueueFilters = {
      status: ["payment_validated", "in_preparation"],
      fulfillment: "pickup",
      code: "P-01",
    };
    expect(hasActiveFilters(filters)).toBe(true);
    expect(describeQueueFilters(filters)).toBe(
      "Filtros: estado Pago validado o En preparación; modalidad Retiro en farmacia; " +
        "código que empieza con P-01.",
    );
  });
});

describe("queueResultText", () => {
  const base = { pending: false, count: 0, hasMore: false, filters: EMPTY_QUEUE_FILTERS };

  it("announces loading and empty states", () => {
    expect(queueResultText({ ...base, pending: true })).toBe("Cargando pedidos…");
    expect(queueResultText(base)).toBe("Aún no hay pedidos confirmados.");
    expect(
      queueResultText({ ...base, filters: { ...EMPTY_QUEUE_FILTERS, fulfillment: "delivery" } }),
    ).toBe("No hay pedidos que cumplan los filtros. Filtros: modalidad Despacho simulado.");
  });

  it("announces how many orders are shown", () => {
    expect(queueResultText({ ...base, count: 1 })).toBe(
      "Mostrando 1 pedido. Sin filtros: todos los pedidos.",
    );
    expect(queueResultText({ ...base, count: 20, hasMore: true })).toBe(
      "Mostrando 20 pedidos (hay más). Sin filtros: todos los pedidos.",
    );
  });
});
