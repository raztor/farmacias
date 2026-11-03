import { FULFILLMENT_LABELS, FULFILLMENT_TYPES } from "@repo/shared";
import Link from "next/link";

import { buttonClasses } from "../../components/button-link";
import { FilterForm } from "../../components/filter-form";
import {
  CHECKBOX_CLASSES,
  FIELD_CONTROL_CLASSES,
  FIELD_ERROR_CLASSES,
  FIELD_HINT_CLASSES,
  FIELD_LABEL_CLASSES,
  INLINE_LINK_CLASSES,
} from "../../components/form-styles";
import { statusLabel } from "./orders-format";
import {
  ACTIONABLE_STATUSES,
  ORDER_CODE_MAX_LENGTH,
  QUEUE_PARAMS,
  QUEUE_PATH,
  QUEUE_STATUS_OPTIONS,
  hasActiveFilters,
  queueSearch,
  type ParsedQueueFilters,
} from "./queue-filters";

const ACTIONABLE_HREF = `${QUEUE_PATH}${queueSearch({
  status: ACTIONABLE_STATUSES,
  fulfillment: null,
  code: "",
})}`;

function StatusFieldset({ selected }: Readonly<{ selected: readonly string[] }>) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${FIELD_LABEL_CLASSES} mb-1`}>Estado</legend>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {QUEUE_STATUS_OPTIONS.map((status) => (
          <label key={status} className="flex min-h-6 flex-row items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={QUEUE_PARAMS.status}
              value={status}
              defaultChecked={selected.includes(status)}
              className={CHECKBOX_CLASSES}
            />
            {statusLabel(status)}
          </label>
        ))}
      </div>
      <p className={FIELD_HINT_CLASSES}>Sin estados marcados se muestran todos.</p>
    </fieldset>
  );
}

function CodeField({ value, error }: Readonly<{ value: string; error: string | null }>) {
  const describedBy = error === null ? "queue-code-hint" : "queue-code-hint queue-code-error";
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="queue-code" className={FIELD_LABEL_CLASSES}>
        Código de pedido
      </label>
      <input
        id="queue-code"
        name={QUEUE_PARAMS.code}
        type="search"
        defaultValue={value}
        maxLength={ORDER_CODE_MAX_LENGTH * 2}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error !== null}
        aria-describedby={describedBy}
        className={FIELD_CONTROL_CLASSES}
      />
      <p id="queue-code-hint" className={FIELD_HINT_CLASSES}>
        Completo o el inicio, por ejemplo P-000123.
      </p>
      {error === null ? null : (
        <p id="queue-code-error" role="alert" className={FIELD_ERROR_CLASSES}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Queue filters (HU-07): statuses, modality and order code, kept in the URL. */
export function QueueFiltersForm({ parsed }: Readonly<{ parsed: ParsedQueueFilters }>) {
  const { filters } = parsed;
  return (
    <section aria-label="Filtros" className="flex flex-col gap-4">
      <nav aria-label="Vistas rápidas" className="flex flex-row flex-wrap gap-4 text-sm">
        <Link href={ACTIONABLE_HREF} className={INLINE_LINK_CLASSES}>
          Por gestionar
        </Link>
        <Link href={QUEUE_PATH} className={INLINE_LINK_CLASSES}>
          Todos los pedidos
        </Link>
      </nav>
      <FilterForm
        action={QUEUE_PATH}
        label="Filtrar pedidos"
        className="flex flex-col gap-5 rounded-lg border border-border bg-card p-4"
      >
        <StatusFieldset selected={filters.status} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="queue-fulfillment" className={FIELD_LABEL_CLASSES}>
              Modalidad
            </label>
            <select
              id="queue-fulfillment"
              name={QUEUE_PARAMS.fulfillment}
              defaultValue={filters.fulfillment ?? ""}
              className={FIELD_CONTROL_CLASSES}
            >
              <option value="">Todas</option>
              {FULFILLMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {FULFILLMENT_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <CodeField value={parsed.codeInput} error={parsed.codeError} />
        </div>
        <div className="flex flex-row flex-wrap items-center gap-4">
          <button type="submit" className={buttonClasses("primary")}>
            Aplicar filtros
          </button>
          {hasActiveFilters(filters) || parsed.codeError !== null ? (
            <Link href={QUEUE_PATH} className={buttonClasses("outline")}>
              Limpiar filtros
            </Link>
          ) : null}
        </div>
      </FilterForm>
    </section>
  );
}
