import type { ApiDependencies } from "../../trpc";
import { orderNotFoundError } from "../orders";
import { statusLabel } from "../order-status";
import {
  createTrackingRepository,
  type OrderDetailRecord,
  type OrderListRecord,
  type StatusEventRecord,
  type TrackingRepository,
} from "./tracking.repository";
import type {
  MyOrderDetail,
  MyOrderItem,
  MyOrdersQuery,
  MyOrdersResult,
  TimelineEntry,
} from "./tracking.schema";

export type TrackingService = {
  /** «Mis pedidos»: own non-draft orders, newest first, cursor pagination (R-TRK-04). */
  mine: (residentId: string, query: MyOrdersQuery) => Promise<MyOrdersResult>;
  /**
   * Own order with its chronological timeline (HU-09 #1). Another account's order, or a missing
   * one, throws the same NOT_FOUND (HU-09 #2, R-TRK-03, D-10).
   */
  detail: (residentId: string, orderId: string) => Promise<MyOrderDetail>;
};

/**
 * Timeline milestones in ascending chronological order (R-TRK-01), each with its Spanish label
 * and the actor role only (R-TRK-02). The sort is stable, so events stored at the same instant
 * keep the repository order (`created_at, id`).
 */
export const toTimeline = (events: readonly StatusEventRecord[]): TimelineEntry[] =>
  [...events]
    .sort((left, right) => left.at.getTime() - right.at.getTime())
    .map((event) => ({
      status: event.status,
      label: statusLabel(event.status),
      actorRole: event.actorRole,
      note: event.note,
      at: event.at,
    }));

export const toMyOrderItem = (order: OrderListRecord): MyOrderItem => ({
  id: order.id,
  code: order.code,
  status: order.status,
  statusLabel: statusLabel(order.status),
  fulfillment: order.fulfillment,
  totalClp: order.totalClp,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

export const toMyOrderDetail = (order: OrderDetailRecord): MyOrderDetail => ({
  ...toMyOrderItem(order),
  version: order.version,
  lines: order.lines,
  delivery: order.delivery,
  timeline: toTimeline(order.events),
});

export const createTrackingService = ({ repo }: { repo: TrackingRepository }): TrackingService => ({
  mine: async (residentId, { limit, cursor }) => {
    const rows = await repo.listMine({ residentId, cursor, take: limit + 1 });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toMyOrderItem);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  },
  detail: async (residentId, orderId) => {
    const order = await repo.findOwned({ residentId, orderId });
    if (!order) throw orderNotFoundError();
    return toMyOrderDetail(order);
  },
});

export const createTrackingServiceFromDeps = (deps: Pick<ApiDependencies, "db">): TrackingService =>
  createTrackingService({ repo: createTrackingRepository(deps.db) });
