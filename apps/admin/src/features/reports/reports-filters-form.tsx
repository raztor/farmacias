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
  REPORTS_PARAMS,
  REPORTS_PATH,
  hasActiveReportsFilters,
  type ParsedReportsFilters,
} from "./reports-filters";

const ERROR_ID = "reports-range-error";
const HINT_ID = "reports-range-hint";

function DayField({
  id,
  label,
  name,
  value,
  invalid,
}: Readonly<{ id: string; label: string; name: string; value: string; invalid: boolean }>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={FIELD_LABEL_CLASSES}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="date"
        defaultValue={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${HINT_ID} ${ERROR_ID}` : HINT_ID}
        className={FIELD_CONTROL_CLASSES}
      />
    </div>
  );
}

/** Date range of the reports (both ends included, Chile's calendar), kept in the URL. */
export function ReportsFiltersForm({ parsed }: Readonly<{ parsed: ParsedReportsFilters }>) {
  const invalid = parsed.error !== null;
  return (
    <FilterForm
      action={REPORTS_PATH}
      label="Rango de los reportes"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DayField
          id="reports-from"
          label="Desde"
          name={REPORTS_PARAMS.from}
          value={parsed.input.from}
          invalid={invalid}
        />
        <DayField
          id="reports-to"
          label="Hasta"
          name={REPORTS_PARAMS.to}
          value={parsed.input.to}
          invalid={invalid}
        />
      </div>
      <p id={HINT_ID} className={FIELD_HINT_CLASSES}>
        Ambas fechas se incluyen. Sin fechas se muestran los últimos 30 días; el rango máximo es de
        un año.
      </p>
      {invalid ? (
        <p id={ERROR_ID} role="alert" className={FIELD_ERROR_CLASSES}>
          {parsed.error} Se muestran los últimos 30 días.
        </p>
      ) : null}
      <div className="flex flex-row flex-wrap items-center gap-4">
        <button type="submit" className={buttonClasses("primary")}>
          Aplicar rango
        </button>
        {hasActiveReportsFilters(parsed) ? (
          <Link href={REPORTS_PATH} className={buttonClasses("outline")}>
            Últimos 30 días
          </Link>
        ) : null}
      </div>
    </FilterForm>
  );
}
