import { FULFILLMENT_LABELS, type FulfillmentType } from "@repo/shared";
import { RadioGroup, RadioOption } from "@repo/ui";

type FulfillmentPickerProps = Readonly<{
  value: FulfillmentType | null;
  onChange: (value: FulfillmentType) => void;
}>;

/** Pickup at the pharmacy or simulated delivery (HU-04). */
export function FulfillmentPicker({ value, onChange }: FulfillmentPickerProps) {
  return (
    <RadioGroup label="¿Cómo quieres recibir tu pedido?">
      <RadioOption
        label={FULFILLMENT_LABELS.pickup}
        description="Lo retiras en la Farmacia Comunitaria. No necesitas ingresar una dirección."
        selected={value === "pickup"}
        onSelect={() => {
          onChange("pickup");
        }}
        testID="fulfillment-pickup"
      />
      <RadioOption
        label={FULFILLMENT_LABELS.delivery}
        description="Simulación de despacho: usa solo datos ficticios, nunca tu dirección real."
        selected={value === "delivery"}
        onSelect={() => {
          onChange("delivery");
        }}
        testID="fulfillment-delivery"
      />
    </RadioGroup>
  );
}
