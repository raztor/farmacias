import { TABLE_CELL_CLASSES, TABLE_HEADER_CLASSES } from "../../components/form-styles";
import { StatCard } from "../stats";
import {
  NUMBER_CELL_CLASSES,
  NUMBER_HEADER_CLASSES,
  ROW_HEADER_CLASSES,
  ReportSection,
  ReportTable,
} from "./report-section";
import { formatCount, lowStockCaption } from "./reports-format";
import type { ReportsSummary } from "./use-reports-summary";

type LowStock = ReportsSummary["lowStock"];

/** Stock level as text plus a symbol: never conveyed by color only (RNF-01). */
const LEVEL_TEXT = { out: "✕ Agotado", low: "! Bajo umbral", available: "✓ Disponible" } as const;

function LowStockTable({ lowStock }: Readonly<{ lowStock: LowStock }>) {
  return (
    <ReportTable caption={lowStockCaption(lowStock.items.length, lowStock.total)}>
      <thead>
        <tr>
          <th scope="col" className={TABLE_HEADER_CLASSES}>
            Producto
          </th>
          <th scope="col" className={TABLE_HEADER_CLASSES}>
            SKU
          </th>
          <th scope="col" className={NUMBER_HEADER_CLASSES}>
            Stock
          </th>
          <th scope="col" className={NUMBER_HEADER_CLASSES}>
            Umbral
          </th>
          <th scope="col" className={TABLE_HEADER_CLASSES}>
            Situación
          </th>
        </tr>
      </thead>
      <tbody>
        {lowStock.items.map((item) => (
          <tr key={item.productId} className="border-t border-border">
            <th scope="row" className={ROW_HEADER_CLASSES}>
              <span className="block">{item.name}</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {item.presentation}
              </span>
            </th>
            <td className={`${TABLE_CELL_CLASSES} font-mono text-xs`}>{item.sku}</td>
            <td className={NUMBER_CELL_CLASSES}>{formatCount(item.onHand)}</td>
            <td className={NUMBER_CELL_CLASSES}>{formatCount(item.lowStockThreshold)}</td>
            <td className={`${TABLE_CELL_CLASSES} whitespace-nowrap`}>{LEVEL_TEXT[item.level]}</td>
          </tr>
        ))}
      </tbody>
    </ReportTable>
  );
}

/** Products at or under their threshold right now (D-27, R-REP-06): not tied to the range. */
export function LowStockReport({ lowStock }: Readonly<{ lowStock: LowStock }>) {
  return (
    <ReportSection
      id="report-low-stock"
      title="Productos bajo umbral"
      description="Situación actual del inventario (no depende del rango de fechas)."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Productos bajo umbral"
          description="Productos activos con stock igual o menor a su umbral."
          value={lowStock.total}
        />
      </div>
      {lowStock.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ningún producto activo está bajo su umbral de stock.
        </p>
      ) : (
        <LowStockTable lowStock={lowStock} />
      )}
    </ReportSection>
  );
}
