const numberFormatter = new Intl.NumberFormat("es-CL");

/** Placeholder shown while a KPI is loading. */
export const STAT_PLACEHOLDER = "—";

/** KPI value with Chilean thousands separators, or a dash while it is loading (`undefined`). */
export function formatStatValue(value: number | undefined): string {
  return value === undefined ? STAT_PLACEHOLDER : numberFormatter.format(value);
}
