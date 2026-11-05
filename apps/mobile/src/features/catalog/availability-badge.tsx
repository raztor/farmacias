import type { ProductAvailability } from "@repo/api";
import { Badge } from "@repo/ui";

import { availabilityView } from "./availability";

type AvailabilityBadgeProps = Readonly<{
  availability: ProductAvailability;
  availableQty: number;
  testID?: string;
}>;

/** Availability with icon + text (never color only, RNF-01). */
export function AvailabilityBadge({ availability, availableQty, testID }: AvailabilityBadgeProps) {
  const view = availabilityView({ availability, availableQty });
  return (
    <Badge tone={view.tone} accessibilityLabel={`Disponibilidad: ${view.label}`} testID={testID}>
      {view.label}
    </Badge>
  );
}
