import { TABLE_HEADER_CLASSES } from "../../components/form-styles";
import { StatusBadge } from "../orders";
import { StatCard } from "../stats";
import {
  NUMBER_CELL_CLASSES,
  NUMBER_HEADER_CLASSES,
  ROW_HEADER_CLASSES,
  ReportSection,
  ReportTable,
} from "./report-section";
import { formatCount, shareText } from "./reports-format";
import type { ReportsSummary } from "./use-reports-summary";

type OrdersByStatusReportProps = Readonly<{ report: ReportsSummary["ordersByStatus"] }>;

/** Orders placed in the range by current status, drafts excluded (R-REP-02). */
export function OrdersByStatusReport({ report }: OrdersByStatusReportProps) {
  return (
    <ReportSection
      id="report-orders-by-status"
      title="Pedidos por estado"
      description="Pedidos confirmados dentro del rango, según su estado actual (no incluye carros en borrador)."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Pedidos confirmados"
          description="Pedidos colocados en el rango, en cualquier estado."
          value={report.total}
        />
      </div>
      <ReportTable caption="Cantidad de pedidos confirmados en el rango por estado actual">
        <thead>
          <tr>
            <th scope="col" className={TABLE_HEADER_CLASSES}>
              Estado
            </th>
            <th scope="col" className={NUMBER_HEADER_CLASSES}>
              Pedidos
            </th>
            <th scope="col" className={NUMBER_HEADER_CLASSES}>
              Porcentaje
            </th>
          </tr>
        </thead>
        <tbody>
          {report.items.map((item) => (
            <tr key={item.status} className="border-t border-border">
              <th scope="row" className={ROW_HEADER_CLASSES}>
                <StatusBadge status={item.status} />
              </th>
              <td className={NUMBER_CELL_CLASSES}>{formatCount(item.count)}</td>
              <td className={NUMBER_CELL_CLASSES}>{shareText(item.count, report.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border">
            <th scope="row" className={ROW_HEADER_CLASSES}>
              Total
            </th>
            <td className={`${NUMBER_CELL_CLASSES} font-semibold`}>{formatCount(report.total)}</td>
            <td className={NUMBER_CELL_CLASSES}>{shareText(report.total, report.total)}</td>
          </tr>
        </tfoot>
      </ReportTable>
    </ReportSection>
  );
}
