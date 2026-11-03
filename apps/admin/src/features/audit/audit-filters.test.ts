import { describe, expect, it } from "vitest";

import {
  AUDIT_PAGE_SIZE,
  EMPTY_AUDIT_FILTERS,
  ENTITY_ID_MAX_LENGTH,
  auditResultText,
  auditSearch,
  hasActiveAuditFilters,
  parseAuditFilters,
  toAuditInput,
} from "./audit-filters";

describe("parseAuditFilters", () => {
  it("reads entity type, action and entity id", () => {
    expect(
      parseAuditFilters({ entity: "order", action: "order.transition", id: " o1 " }).filters,
    ).toEqual({ entityType: "order", action: "order.transition", entityId: "o1" });
  });

  it("ignores unknown or blank values", () => {
    expect(
      parseAuditFilters({ entity: "invoice", action: "stock.delete", id: "" }).filters,
    ).toEqual(EMPTY_AUDIT_FILTERS);
  });

  it("reports a too-long id and does not search with it", () => {
    const parsed = parseAuditFilters({ id: "x".repeat(ENTITY_ID_MAX_LENGTH + 1) });

    expect(parsed.filters.entityId).toBe("");
    expect(parsed.entityIdError).toBe("El identificador admite hasta 64 caracteres.");
  });
});

describe("filters ↔ URL and API input", () => {
  const filters = { entityType: "user", action: "user.role_change", entityId: "u1" } as const;

  it("serializes only active filters", () => {
    expect(auditSearch(filters)).toBe("?entity=user&action=user.role_change&id=u1");
    expect(auditSearch(EMPTY_AUDIT_FILTERS)).toBe("");
  });

  it("round-trips through the URL", () => {
    const params = Object.fromEntries(new URLSearchParams(auditSearch(filters)));

    expect(parseAuditFilters(params).filters).toEqual(filters);
  });

  it("builds the audit.list input", () => {
    expect(toAuditInput(EMPTY_AUDIT_FILTERS)).toEqual({ limit: AUDIT_PAGE_SIZE });
    expect(toAuditInput(filters)).toEqual({
      limit: AUDIT_PAGE_SIZE,
      entityType: "user",
      action: "user.role_change",
      entityId: "u1",
    });
    expect(hasActiveAuditFilters(filters)).toBe(true);
    expect(hasActiveAuditFilters(EMPTY_AUDIT_FILTERS)).toBe(false);
  });
});

describe("auditResultText", () => {
  it("announces loading, empty and counts", () => {
    expect(auditResultText(true, 0, EMPTY_AUDIT_FILTERS)).toBe("Cargando registros…");
    expect(auditResultText(false, 0, EMPTY_AUDIT_FILTERS)).toBe(
      "Aún no hay registros de auditoría.",
    );
    expect(auditResultText(false, 0, { ...EMPTY_AUDIT_FILTERS, action: "stock.sale" })).toBe(
      "No hay registros que cumplan los filtros.",
    );
    expect(auditResultText(false, 1, EMPTY_AUDIT_FILTERS)).toBe("Mostrando 1 registro.");
    expect(auditResultText(false, 7, EMPTY_AUDIT_FILTERS)).toBe("Mostrando 7 registros.");
  });
});
