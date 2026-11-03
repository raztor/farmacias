import { AUDIT_ACTIONS, isAuditAction, type AuditAction } from "@repo/shared";

import {
  readFirst,
  toSearch,
  type SearchPair,
  type SearchParamsRecord,
} from "../../lib/search-params";

export const AUDIT_PATH = "/audit";

/** Audit rows per "Cargar más" page. */
export const AUDIT_PAGE_SIZE = 20;

/** Same limit as the API's `audit.list` entity id. */
export const ENTITY_ID_MAX_LENGTH = 64;

/** Entities with audit rows (same list as the API's `AUDIT_ENTITY_TYPES`). */
export const AUDIT_ENTITY_OPTIONS = ["order", "product", "user"] as const;
export type AuditEntityOption = (typeof AUDIT_ENTITY_OPTIONS)[number];

export const AUDIT_ACTION_OPTIONS: readonly AuditAction[] = AUDIT_ACTIONS;

export const AUDIT_PARAMS = { entityType: "entity", action: "action", entityId: "id" } as const;

export const isAuditEntityOption = (value: string | undefined): value is AuditEntityOption =>
  AUDIT_ENTITY_OPTIONS.some((option) => option === value);

export type AuditFilters = Readonly<{
  entityType: AuditEntityOption | null;
  action: AuditAction | null;
  /** Exact entity id; `""` = any. */
  entityId: string;
}>;

export const EMPTY_AUDIT_FILTERS: AuditFilters = { entityType: null, action: null, entityId: "" };

export type ParsedAuditFilters = Readonly<{
  filters: AuditFilters;
  entityIdInput: string;
  entityIdError: string | null;
}>;

/** Audit filters from the page URL; unknown values are ignored, a too-long id is reported. */
export function parseAuditFilters(params: SearchParamsRecord): ParsedAuditFilters {
  const entityType = readFirst(params, AUDIT_PARAMS.entityType);
  const action = readFirst(params, AUDIT_PARAMS.action);
  const entityIdInput = readFirst(params, AUDIT_PARAMS.entityId) ?? "";
  const entityIdError =
    entityIdInput.length > ENTITY_ID_MAX_LENGTH
      ? `El identificador admite hasta ${String(ENTITY_ID_MAX_LENGTH)} caracteres.`
      : null;

  return {
    filters: {
      entityType: isAuditEntityOption(entityType) ? entityType : null,
      action: isAuditAction(action) ? action : null,
      entityId: entityIdError === null ? entityIdInput : "",
    },
    entityIdInput,
    entityIdError,
  };
}

/** Query string of the audit page for these filters (`""` without filters). Pure. */
export function auditSearch(filters: AuditFilters): string {
  const pairs: SearchPair[] = [];
  if (filters.entityType !== null) pairs.push([AUDIT_PARAMS.entityType, filters.entityType]);
  if (filters.action !== null) pairs.push([AUDIT_PARAMS.action, filters.action]);
  if (filters.entityId !== "") pairs.push([AUDIT_PARAMS.entityId, filters.entityId]);
  return toSearch(pairs);
}

/** Input of `audit.list` with only the active filters (stable query key). Pure. */
export function toAuditInput(filters: AuditFilters) {
  return {
    limit: AUDIT_PAGE_SIZE,
    ...(filters.entityType === null ? {} : { entityType: filters.entityType }),
    ...(filters.action === null ? {} : { action: filters.action }),
    ...(filters.entityId === "" ? {} : { entityId: filters.entityId }),
  };
}

export function hasActiveAuditFilters(filters: AuditFilters): boolean {
  return filters.entityType !== null || filters.action !== null || filters.entityId !== "";
}

/** Text of the results live region. Pure. */
export function auditResultText(pending: boolean, count: number, filters: AuditFilters): string {
  if (pending) return "Cargando registros…";
  if (count === 0) {
    return hasActiveAuditFilters(filters)
      ? "No hay registros que cumplan los filtros."
      : "Aún no hay registros de auditoría.";
  }
  return count === 1 ? "Mostrando 1 registro." : `Mostrando ${String(count)} registros.`;
}
