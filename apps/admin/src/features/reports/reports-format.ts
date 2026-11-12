const countFormatter = new Intl.NumberFormat("es-CL");

/** A count with Chilean thousands separators ("1.234"). Pure. */
export function formatCount(value: number): string {
  return countFormatter.format(value);
}

/** "2026-11-11" → "11-11-2026" (Chilean day order). Pure. */
export function formatReportDay(day: string): string {
  const [year, month, date] = day.split("-");
  return year && month && date ? `${date}-${month}-${year}` : day;
}

/** Range actually used by the report, both ends included. Pure. */
export function rangeLabel(range: Readonly<{ from: string; to: string }>): string {
  return range.from === range.to
    ? `Datos del ${formatReportDay(range.from)} (hora de Chile).`
    : `Datos del ${formatReportDay(range.from)} al ${formatReportDay(range.to)}, ambos incluidos (hora de Chile).`;
}

/** Share of `part` in `total` as a whole percentage ("0 %" when the total is 0). Pure. */
export function shareText(part: number, total: number): string {
  const percent = total === 0 ? 0 : Math.round((part / total) * 100);
  return `${formatCount(percent)} %`;
}

/** Caption of the low-stock table, saying when only part of the list is shown. Pure. */
export function lowStockCaption(shown: number, total: number): string {
  const base = "Productos activos con stock igual o menor a su umbral, agotados primero";
  return shown < total
    ? `${base} (se muestran ${formatCount(shown)} de ${formatCount(total)})`
    : base;
}
