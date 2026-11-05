/**
 * Display formatting for the resident app (pure, safe to call while rendering).
 * Money is integer CLP computed by the server; dates are shown in Chile's time zone (D-23).
 */

const CLP_FORMAT = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const CHILE_TIME_ZONE = "America/Santiago";

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("es-CL", {
  timeZone: CHILE_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const DATE_FORMAT = new Intl.DateTimeFormat("es-CL", {
  timeZone: CHILE_TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** `12990` → «$12.990». */
export function formatClp(amount: number): string {
  return CLP_FORMAT.format(amount);
}

/** Date and time in Chile, e.g. «3 nov 2026, 10:42». */
export function formatDateTime(date: Date): string {
  return DATE_TIME_FORMAT.format(date);
}

/** Date in Chile, e.g. «3 nov 2026». */
export function formatDate(date: Date): string {
  return DATE_FORMAT.format(date);
}

/** `1` → «1 unidad», `3` → «3 unidades». */
export function formatUnits(count: number): string {
  return `${String(count)} ${count === 1 ? "unidad" : "unidades"}`;
}
