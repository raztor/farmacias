import type { ProductAvailability } from "@repo/api";
import type { Tone } from "@repo/ui";

import { formatUnits } from "../../lib/format";

export type AvailabilityView = Readonly<{
  /** Short text of the badge (never color only, RNF-01). */
  label: string;
  tone: Tone;
  /** Sentence for the product detail. */
  description: string;
}>;

type AvailabilityInput = Readonly<{ availability: ProductAvailability; availableQty: number }>;

/** Badge text, tone and explanation of a product's availability (HU-01 #1). Pure. */
export function availabilityView({
  availability,
  availableQty,
}: AvailabilityInput): AvailabilityView {
  switch (availability) {
    case "available": {
      return {
        label: "Disponible",
        tone: "success",
        description: `Hay ${formatUnits(availableQty)} disponibles en la farmacia.`,
      };
    }
    case "low": {
      return {
        label: `Quedan pocas (${String(availableQty)})`,
        tone: "warning",
        description: `Quedan pocas unidades: ${formatUnits(availableQty)}.`,
      };
    }
    case "out": {
      return {
        label: "Sin stock",
        tone: "destructive",
        description: "No hay unidades disponibles por ahora. Vuelve a consultar más tarde.",
      };
    }
  }
}
