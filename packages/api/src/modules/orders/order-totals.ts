/**
 * Money and quantities of an order (R-ORD-06): Chilean pesos as integers, always computed on the
 * server. The client never sends prices or totals.
 */

export type PricedLine = { quantity: number; unitPriceClp: number };

const assertSafeInteger = (value: number, what: string): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${what} must be a non-negative safe integer, got ${String(value)}`);
  }
  return value;
};

/** `quantity × unitPriceClp`, in integer CLP. */
export const lineTotalClp = ({ quantity, unitPriceClp }: PricedLine): number =>
  assertSafeInteger(
    assertSafeInteger(quantity, "quantity") * assertSafeInteger(unitPriceClp, "unitPriceClp"),
    "lineTotalClp",
  );

/** Sum of the line totals, in integer CLP. */
export const orderTotalClp = (lines: readonly PricedLine[]): number =>
  assertSafeInteger(
    lines.reduce((total, line) => total + lineTotalClp(line), 0),
    "totalClp",
  );

/** Number of units in the order (badge of "Mi pedido"). */
export const orderItemCount = (lines: readonly { quantity: number }[]): number =>
  lines.reduce((count, line) => count + line.quantity, 0);
