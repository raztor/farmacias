import type { OrderStatus } from "@repo/shared";

export type StatusTone = "neutral" | "progress" | "success" | "warning" | "danger";

/**
 * Visual tone of a status badge. Color is only a reinforcement: the badge always shows the
 * Spanish label and a symbol (RNF-01, never color only).
 */
const STATUS_TONES: Readonly<Record<OrderStatus, StatusTone>> = {
  draft: "neutral",
  pending_payment: "warning",
  payment_validated: "progress",
  payment_rejected: "danger",
  in_preparation: "progress",
  ready_for_pickup: "success",
  in_transit: "progress",
  delivered: "success",
  not_delivered: "danger",
  cancelled: "neutral",
};

/** Symbol shown next to the label (hidden from screen readers, which read the label). */
export const TONE_SYMBOLS: Readonly<Record<StatusTone, string>> = {
  neutral: "○",
  progress: "◔",
  success: "✓",
  warning: "!",
  danger: "✕",
};

/** Tailwind classes per tone; every pair meets WCAG AA contrast on its background. */
export const TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  progress: "border-primary bg-accent text-foreground",
  success: "border-success bg-success text-success-foreground",
  warning: "border-warning bg-warning text-warning-foreground",
  danger: "border-destructive bg-destructive text-destructive-foreground",
};

export function statusTone(status: OrderStatus): StatusTone {
  return STATUS_TONES[status];
}
