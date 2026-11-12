import { TABLE_CELL_CLASSES, TABLE_HEADER_CLASSES } from "../../components/form-styles";
import { StatCard } from "../stats";
import {
  NUMBER_CELL_CLASSES,
  NUMBER_HEADER_CLASSES,
  ROW_HEADER_CLASSES,
  ReportSection,
  ReportTable,
} from "./report-section";
import { formatCount } from "./reports-format";
import type { ReportsSummary } from "./use-reports-summary";

type DispensedReportProps = Readonly<{ report: ReportsSummary["dispensed"] }>;

function TopProductsTable({
  products,
}: Readonly<{ products: DispensedReportProps["report"]["topProducts"] }>) {
  return (
    <ReportTable caption="Productos más dispensados en el rango, de más a menos unidades">
      <thead>
        <tr>
          <th scope="col" className={TABLE_HEADER_CLASSES}>
            Producto
          </th>
          <th scope="col" className={TABLE_HEADER_CLASSES}>
            SKU
          </th>
          <th scope="col" className={NUMBER_HEADER_CLASSES}>
            Unidades
          </th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.productId} className="border-t border-border">
            <th scope="row" className={ROW_HEADER_CLASSES}>
              <span className="block">{product.name}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {product.presentation}
              </span>
            </th>
            <td className={`${TABLE_CELL_CLASSES} font-mono text-xs`}>{product.sku}</td>
            <td className={NUMBER_CELL_CLASSES}>{formatCount(product.units)}</td>
          </tr>
        ))}
      </tbody>
    </ReportTable>
  );
}

/** Units handed to residents: orders delivered (picked up or dispatched) in the range (R-REP-01). */
export function DispensedReport({ report }: DispensedReportProps) {
  return (
    <ReportSection
      id="report-dispensed"
      title="Unidades dispensadas"
      description="Unidades de los pedidos entregados (retirados en farmacia o despachados) dentro del rango."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Unidades dispensadas"
          description="Suma de unidades de los pedidos entregados."
          value={report.units}
        />
        <StatCard
          label="Pedidos entregados"
          description="Pedidos que pasaron a «Entregado» en el rango."
          value={report.orders}
        />
      </div>
      {report.topProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No se entregaron pedidos en este rango.</p>
      ) : (
        <TopProductsTable products={report.topProducts} />
      )}
    </ReportSection>
  );
}
