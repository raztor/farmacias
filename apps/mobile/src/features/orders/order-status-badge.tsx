import type { OrderStatus } from "@repo/shared";
import { Badge } from "@repo/ui";

import { statusTone } from "./order-status-view";

type OrderStatusBadgeProps = Readonly<{ status: OrderStatus; label: string; testID?: string }>;

/** Order status with icon + Spanish label (never color only, R-TRK-01). */
export function OrderStatusBadge({ status, label, testID }: OrderStatusBadgeProps) {
  return (
    <Badge tone={statusTone(status)} accessibilityLabel={`Estado: ${label}`} testID={testID}>
      {label}
    </Badge>
  );
}
