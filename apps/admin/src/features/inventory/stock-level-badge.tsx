import type { StockLevel } from "@repo/api";
import { cn } from "@repo/ui";

import { TONE_CLASSES, TONE_SYMBOLS } from "../orders";
import { STOCK_LEVEL_LABELS, STOCK_LEVEL_TONES } from "./inventory-format";

type StockLevelBadgeProps = Readonly<{ level: StockLevel; className?: string }>;

/** Stock level pill: Spanish label + symbol, color only reinforces them (RNF-01, D-17). */
export function StockLevelBadge({ level, className }: StockLevelBadgeProps) {
  const tone = STOCK_LEVEL_TONES[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span aria-hidden="true">{TONE_SYMBOLS[tone]}</span>
      {STOCK_LEVEL_LABELS[level]}
    </span>
  );
}
