import type { Prisma } from "@repo/db";
import { isOrderStatus, type OrderStatus } from "@repo/shared";

/** A line of the order to repeat, with its product as it is in the catalog now. */
export type RepeatSourceLineRecord = {
  productId: string;
  quantity: number;
  commercialName: string;
  priceClp: number;
  active: boolean;
  onHand: number;
};

/** The order to repeat (HU-14): owner and status are checked by the service. */
export type RepeatSourceRecord = {
  id: string;
  residentId: string;
  status: OrderStatus;
  lines: RepeatSourceLineRecord[];
};

/** Reads an order and its lines joined with the current catalog data (no locks: D-08). */
export const findRepeatSource = async (
  tx: Pick<Prisma.TransactionClient, "order">,
  orderId: string,
): Promise<RepeatSourceRecord | null> => {
  const row = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      residentId: true,
      status: true,
      lines: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          productId: true,
          quantity: true,
          product: {
            select: {
              commercialName: true,
              priceClp: true,
              active: true,
              inventory: { select: { onHand: true } },
            },
          },
        },
      },
    },
  });
  if (!row) return null;
  if (!isOrderStatus(row.status)) throw new Error(`Unknown order status "${row.status}"`);
  return {
    id: row.id,
    residentId: row.residentId,
    status: row.status,
    lines: row.lines.map(({ productId, quantity, product }) => ({
      productId,
      quantity,
      commercialName: product.commercialName,
      priceClp: product.priceClp,
      active: product.active,
      onHand: product.inventory?.onHand ?? 0,
    })),
  };
};
