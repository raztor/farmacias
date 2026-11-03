import type { TimelineEntry } from "@repo/api";
import type { ActorRole, OrderStatus } from "@repo/shared";
import type { TimelineItem, Tone } from "@repo/ui";

import { formatDateTime } from "../../lib/format";

const STATUS_TONES: Readonly<Record<OrderStatus, Tone>> = {
  draft: "neutral",
  pending_payment: "warning",
  payment_validated: "info",
  payment_rejected: "destructive",
  in_preparation: "info",
  ready_for_pickup: "success",
  in_transit: "info",
  delivered: "success",
  not_delivered: "destructive",
  cancelled: "neutral",
};

/** Tone (and therefore glyph) of a status badge; the Spanish label comes from the API. Pure. */
export function statusTone(status: OrderStatus): Tone {
  return STATUS_TONES[status];
}

/** The owner can (re)try the simulated payment (R-PAY-02). Pure. */
export function canPay(status: OrderStatus): boolean {
  return status === "pending_payment" || status === "payment_rejected";
}

/** The owner can cancel the order (§4.6); after payment the stock is restored automatically. */
export function canCancel(status: OrderStatus): boolean {
  return canPay(status) || status === "payment_validated";
}

const ACTOR_LABELS: Readonly<Record<ActorRole, string>> = {
  resident: "Tú",
  operator: "Farmacia",
  admin: "Farmacia",
  system: "Sistema",
};

/** Who made a change, in plain words; never the name of the pharmacy staff (R-TRK-02). Pure. */
export function actorLabel(role: ActorRole): string {
  return ACTOR_LABELS[role];
}

/**
 * Timeline of an order (HU-09 #1): milestones oldest first, with the Spanish label, who made
 * the change and the time in Chile; the last one is the current status. Pure.
 */
export function toTimelineItems(entries: readonly TimelineEntry[]): TimelineItem[] {
  const sorted = [...entries].sort((a, b) => a.at.getTime() - b.at.getTime());
  return sorted.map((entry, index) => ({
    key: `${String(index)}-${entry.status}`,
    title: entry.label,
    meta: `${actorLabel(entry.actorRole)} · ${formatDateTime(entry.at)}`,
    note: entry.note,
    tone: statusTone(entry.status),
    current: index === sorted.length - 1,
  }));
}
