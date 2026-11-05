import type { DeliveryDetails, RouterInputs } from "@repo/api";
import type { FulfillmentType } from "@repo/shared";
import { z } from "zod";

/**
 * Synthetic delivery data (D-04), with the same limits and messages as `orders.setFulfillment`
 * so the form flags the missing field before calling the API (HU-04 #2).
 */
const requiredText = (min: number, max: number, missing: string, tooLong: string) =>
  z.string().trim().min(min, { error: missing }).max(max, { error: tooLong });

export const deliveryFormSchema = z.object({
  sector: requiredText(2, 60, "Indica el sector", "El sector admite hasta 60 caracteres"),
  addressReference: requiredText(
    3,
    120,
    "Indica una referencia de dirección",
    "La referencia admite hasta 120 caracteres",
  ),
  contactAlias: requiredText(
    2,
    60,
    "Indica un alias de contacto",
    "El alias admite hasta 60 caracteres",
  ),
  instructions: z
    .string()
    .trim()
    .max(200, { error: "Las indicaciones admiten hasta 200 caracteres" }),
});

export type DeliveryFormValues = {
  sector: string;
  addressReference: string;
  contactAlias: string;
  instructions: string;
};

export type DeliveryForm = z.output<typeof deliveryFormSchema>;

export const EMPTY_DELIVERY_FORM: DeliveryFormValues = {
  sector: "",
  addressReference: "",
  contactAlias: "",
  instructions: "",
};

/** Prefills the form with the delivery data already saved in the draft. Pure. */
export function initialDeliveryValues(saved: DeliveryDetails | null): DeliveryFormValues {
  if (saved === null) return EMPTY_DELIVERY_FORM;
  return {
    sector: saved.sector,
    addressReference: saved.addressReference,
    contactAlias: saved.contactAlias,
    instructions: saved.instructions ?? "",
  };
}

type SetFulfillmentInput = RouterInputs["orders"]["setFulfillment"];

/** Builds the `orders.setFulfillment` input: pickup never sends an address (HU-04 #1). Pure. */
export function toFulfillmentInput(
  fulfillment: FulfillmentType,
  delivery: DeliveryForm | null,
): SetFulfillmentInput | null {
  if (fulfillment === "pickup") return { type: "pickup" };
  if (delivery === null) return null;
  const { instructions, ...required } = delivery;
  return { type: "delivery", ...required, ...(instructions.length > 0 ? { instructions } : {}) };
}
