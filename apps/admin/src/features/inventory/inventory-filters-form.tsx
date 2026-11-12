import Link from "next/link";

import { buttonClasses } from "../../components/button-link";
import { FilterForm } from "../../components/filter-form";
import {
  CHECKBOX_CLASSES,
  FIELD_CONTROL_CLASSES,
  FIELD_ERROR_CLASSES,
  FIELD_HINT_CLASSES,
  FIELD_LABEL_CLASSES,
} from "../../components/form-styles";
import {
  INVENTORY_PARAMS,
  INVENTORY_PATH,
  INVENTORY_SEARCH_MAX_LENGTH,
  hasActiveInventoryFilters,
  type ParsedInventoryFilters,
} from "./inventory-filters";

function SearchField({ value, error }: Readonly<{ value: string; error: string | null }>) {
  const describedBy =
    error === null ? "inventory-search-hint" : "inventory-search-hint inventory-search-error";
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="inventory-search" className={FIELD_LABEL_CLASSES}>
        Buscar producto
      </label>
      <input
        id="inventory-search"
        name={INVENTORY_PARAMS.search}
        type="search"
        defaultValue={value}
        maxLength={INVENTORY_SEARCH_MAX_LENGTH * 2}
        autoComplete="off"
        aria-invalid={error !== null}
        aria-describedby={describedBy}
        className={FIELD_CONTROL_CLASSES}
      />
      <p id="inventory-search-hint" className={FIELD_HINT_CLASSES}>
        Nombre, principio activo, presentación o SKU.
      </p>
      {error === null ? null : (
        <p id="inventory-search-error" role="alert" className={FIELD_ERROR_CLASSES}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Stock list filters (HU-10, HU-12): text search and "only low stock", kept in the URL. */
export function InventoryFiltersForm({ parsed }: Readonly<{ parsed: ParsedInventoryFilters }>) {
  const { filters } = parsed;
  return (
    <FilterForm
      action={INVENTORY_PATH}
      label="Filtrar inventario"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <SearchField value={parsed.searchInput} error={parsed.searchError} />
      <label className="flex min-h-6 flex-row items-center gap-2 text-sm">
        <input
          type="checkbox"
          name={INVENTORY_PARAMS.onlyLow}
          value="1"
          defaultChecked={filters.onlyLow}
          className={CHECKBOX_CLASSES}
        />
        Solo stock bajo (en o bajo el umbral)
      </label>
      <div className="flex flex-row flex-wrap items-center gap-4">
        <button type="submit" className={buttonClasses("primary")}>
          Aplicar filtros
        </button>
        {hasActiveInventoryFilters(filters) || parsed.searchError !== null ? (
          <Link href={INVENTORY_PATH} className={buttonClasses("outline")}>
            Limpiar filtros
          </Link>
        ) : null}
      </div>
    </FilterForm>
  );
}
