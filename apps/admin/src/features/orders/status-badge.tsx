import type { OrderStatus } from "@repo/shared";
import { cn } from "@repo/ui";

import { statusLabel } from "./orders-format";
import { TONE_CLASSES, TONE_SYMBOLS, statusTone } from "./status-tone";

type StatusBadgeProps = Readonly<{ status: OrderStatus; className?: string }>;

/** Order status pill: Spanish label + symbol, color only reinforces them (RNF-01). */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span aria-hidden="true">{TONE_SYMBOLS[tone]}</span>
      {statusLabel(status)}
    </span>
  );
}
