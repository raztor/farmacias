import Link from "next/link";

import { buttonClasses } from "../../components/button-link";
import { FilterForm } from "../../components/filter-form";
import {
  FIELD_CONTROL_CLASSES,
  FIELD_ERROR_CLASSES,
  FIELD_HINT_CLASSES,
  FIELD_LABEL_CLASSES,
} from "../../components/form-styles";
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_ENTITY_OPTIONS,
  AUDIT_PARAMS,
  AUDIT_PATH,
  ENTITY_ID_MAX_LENGTH,
  hasActiveAuditFilters,
  type ParsedAuditFilters,
} from "./audit-filters";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "./audit-format";

function EntityIdField({ value, error }: Readonly<{ value: string; error: string | null }>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="audit-entity-id" className={FIELD_LABEL_CLASSES}>
        Identificador de la entidad
      </label>
      <input
        id="audit-entity-id"
        name={AUDIT_PARAMS.entityId}
        type="search"
        defaultValue={value}
        maxLength={ENTITY_ID_MAX_LENGTH * 2}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error !== null}
        aria-describedby={error === null ? "audit-id-hint" : "audit-id-hint audit-id-error"}
        className={FIELD_CONTROL_CLASSES}
      />
      <p id="audit-id-hint" className={FIELD_HINT_CLASSES}>
        Identificador exacto (se completa al elegir «Ver registros» en una fila).
      </p>
      {error === null ? null : (
        <p id="audit-id-error" role="alert" className={FIELD_ERROR_CLASSES}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Audit filters (entity type, action, entity id), kept in the URL. */
export function AuditFiltersForm({ parsed }: Readonly<{ parsed: ParsedAuditFilters }>) {
  const { filters } = parsed;
  return (
    <FilterForm
      action={AUDIT_PATH}
      label="Filtrar auditoría"
      className="flex flex-col gap-5 rounded-lg border border-border bg-card p-4"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-entity" className={FIELD_LABEL_CLASSES}>
            Entidad
          </label>
          <select
            id="audit-entity"
            name={AUDIT_PARAMS.entityType}
            defaultValue={filters.entityType ?? ""}
            className={FIELD_CONTROL_CLASSES}
          >
            <option value="">Todas</option>
            {AUDIT_ENTITY_OPTIONS.map((entity) => (
              <option key={entity} value={entity}>
                {AUDIT_ENTITY_LABELS[entity]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-action" className={FIELD_LABEL_CLASSES}>
            Acción
          </label>
          <select
            id="audit-action"
            name={AUDIT_PARAMS.action}
            defaultValue={filters.action ?? ""}
            className={FIELD_CONTROL_CLASSES}
          >
            <option value="">Todas</option>
            {AUDIT_ACTION_OPTIONS.map((action) => (
              <option key={action} value={action}>
                {AUDIT_ACTION_LABELS[action]}
              </option>
            ))}
          </select>
        </div>
        <EntityIdField value={parsed.entityIdInput} error={parsed.entityIdError} />
      </div>
      <div className="flex flex-row flex-wrap items-center gap-4">
        <button type="submit" className={buttonClasses("primary")}>
          Aplicar filtros
        </button>
        {hasActiveAuditFilters(filters) || parsed.entityIdError !== null ? (
          <Link href={AUDIT_PATH} className={buttonClasses("outline")}>
            Limpiar filtros
          </Link>
        ) : null}
      </div>
    </FilterForm>
  );
}
