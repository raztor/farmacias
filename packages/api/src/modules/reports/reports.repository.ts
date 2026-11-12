import { Prisma, type PrismaClient } from "@repo/db";

/** UTC bounds of a report range: `start <= instant < end`. */
export type ReportWindow = { start: Date; end: Date };

export type DispensedRow = { productId: string; units: number };

export type DispensedTotals = {
  units: number;
  orders: number;
  /** Most units first, ties by product id. */
  top: DispensedRow[];
};

export type StatusRow = { status: string; count: number };

export type ProductLabel = { id: string; sku: string; name: string; presentation: string };

/** Aggregated, read-only queries of the reports (R-REP-01, R-REP-02). */
export type ReportsRepository = {
  dispensed: (window: ReportWindow, take: number) => Promise<DispensedTotals>;
  /** Orders placed (`orders.created_at`, R-DAT-11) in the window: no drafts, no abandoned carts. */
  ordersByStatus: (window: ReportWindow) => Promise<StatusRow[]>;
  productLabels: (ids: readonly string[]) => Promise<ProductLabel[]>;
};

/**
 * Orders dispensed within the window: their current status is `delivered` (terminal, reached
 * once, both for pickup and delivery) and the `delivered` status event falls in the window.
 */
const deliveredInWindow = ({ start, end }: ReportWindow): Prisma.OrderWhereInput => ({
  status: "delivered",
  events: { some: { toStatus: "delivered", createdAt: { gte: start, lt: end } } },
});

export const createReportsRepository = (db: PrismaClient): ReportsRepository => ({
  dispensed: async (window, take) => {
    const orderWhere = deliveredInWindow(window);
    const lineWhere: Prisma.OrderLineWhereInput = { order: orderWhere };
    // REPEATABLE READ: the three statements see the same snapshot, so the totals add up.
    const [sum, orders, top] = await db.$transaction(
      [
        db.orderLine.aggregate({ where: lineWhere, _sum: { quantity: true } }),
        db.order.count({ where: orderWhere }),
        db.orderLine.groupBy({
          by: ["productId"],
          where: lineWhere,
          _sum: { quantity: true },
          orderBy: [{ _sum: { quantity: "desc" } }, { productId: "asc" }],
          take,
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      units: sum._sum.quantity ?? 0,
      orders,
      top: top.map((row) => ({ productId: row.productId, units: row._sum.quantity ?? 0 })),
    };
  },

  ordersByStatus: async ({ start, end }) => {
    const rows = await db.order.groupBy({
      by: ["status"],
      where: {
        status: { not: "draft" },
        createdAt: { gte: start, lt: end },
        // An abandoned cart (draft → cancelled) was never placed: its created_at is when the cart
        // was opened (the placement trigger skips it), so it is not an order of the range.
        events: { none: { fromStatus: "draft", toStatus: "cancelled" } },
      },
      _count: { _all: true },
    });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  },

  productLabels: async (ids) => {
    if (ids.length === 0) return [];
    const rows = await db.product.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, sku: true, commercialName: true, presentation: true },
    });
    return rows.map(({ commercialName, ...row }) => ({ ...row, name: commercialName }));
  },
});
