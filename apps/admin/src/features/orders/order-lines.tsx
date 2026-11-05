import type { OperationsOrderLine } from "@repo/api";
import { cn } from "@repo/ui";

import { TABLE_CELL_CLASSES, TABLE_HEADER_CLASSES } from "../../components/form-styles";
import { DetailSection } from "./detail-section";
import { formatClp } from "./orders-format";

const NUMBER_CELL = `${TABLE_CELL_CLASSES} text-right tabular-nums`;

const COLUMNS = [
  { label: "Producto", className: "" },
  { label: "Cantidad", className: "text-right" },
  { label: "Precio unitario", className: "hidden text-right sm:table-cell" },
  { label: "Subtotal", className: "text-right" },
] as const;

function OrderLineRow({ line }: Readonly<{ line: OperationsOrderLine }>) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className={`${TABLE_CELL_CLASSES} text-left font-medium`}>
        {line.commercialName}
        <span className="block font-normal text-muted-foreground">{line.presentation}</span>
      </th>
      <td className={NUMBER_CELL}>{line.quantity}</td>
      <td className={`${NUMBER_CELL} hidden sm:table-cell`}>{formatClp(line.unitPriceClp)}</td>
      <td className={NUMBER_CELL}>{formatClp(line.lineTotalClp)}</td>
    </tr>
  );
}

type LinesProps = Readonly<{ lines: readonly OperationsOrderLine[]; totalClp: number }>;

/** Products of the order with the prices frozen at confirmation. */
export function OrderLines({ lines, totalClp }: LinesProps) {
  return (
    <DetailSection id="order-lines-title" title="Productos">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse">
          <caption className="sr-only">Productos del pedido</caption>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={cn(TABLE_HEADER_CLASSES, column.className)}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <OrderLineRow key={line.productId} line={line} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border">
              {/* The unit price column is hidden on narrow screens: span one column less. */}
              <th
                scope="row"
                colSpan={2}
                className={`${TABLE_CELL_CLASSES} text-right font-semibold`}
              >
                Total
              </th>
              <td className={`${TABLE_CELL_CLASSES} hidden sm:table-cell`} />
              <td className={`${TABLE_CELL_CLASSES} text-right font-semibold tabular-nums`}>
                {formatClp(totalClp)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </DetailSection>
  );
}
