import type { OrderDraft } from "@repo/api";
import type { FulfillmentType } from "@repo/shared";
import { Button, Notice, Text } from "@repo/ui";
import { useState } from "react";
import { View } from "react-native";

import { FormError } from "../../components/form-error";
import { getServerFieldErrors } from "../../lib/api-error";
import { getApiErrorMessage } from "../../lib/error-message";
import { useZodForm } from "../../lib/use-zod-form";
import { deliveryFormSchema, initialDeliveryValues, toFulfillmentInput } from "./checkout.schema";
import { DeliveryFormFields } from "./delivery-form";
import { FulfillmentPicker } from "./fulfillment-picker";
import { useSubmitCheckout } from "./use-checkout";

const CHOOSE_FULFILLMENT_MESSAGE =
  "Elige retiro en farmacia o despacho simulado para confirmar tu pedido.";

/** Fulfillment choice, synthetic delivery data and confirmation (HU-04). */
export function CheckoutForm({ draft }: Readonly<{ draft: OrderDraft }>) {
  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(draft.fulfillment);
  const [missingChoice, setMissingChoice] = useState(false);
  const form = useZodForm(deliveryFormSchema, initialDeliveryValues(draft.delivery));
  const submit = useSubmitCheckout();
  const serverErrors = getServerFieldErrors(submit.error);
  const hasServerFieldErrors = Object.keys(serverErrors).length > 0;

  const onConfirm = () => {
    if (fulfillment === null) {
      setMissingChoice(true);
      return;
    }
    const delivery = fulfillment === "delivery" ? form.validate() : null;
    const input = toFulfillmentInput(fulfillment, delivery);
    if (input !== null) submit.mutate(input);
  };

  return (
    <View className="gap-5">
      <FulfillmentPicker
        value={fulfillment}
        onChange={(value) => {
          setFulfillment(value);
          setMissingChoice(false);
          submit.reset();
        }}
      />
      {fulfillment === "pickup" ? (
        <Notice tone="info" title="Retiro en farmacia" testID="pickup-summary">
          <Text>
            No necesitas dirección. Podrás retirarlo cuando su estado sea «Listo para retiro».
          </Text>
        </Notice>
      ) : null}
      {fulfillment === "delivery" ? (
        <DeliveryFormFields form={form} serverErrors={serverErrors} />
      ) : null}
      <FormError
        message={missingChoice ? CHOOSE_FULFILLMENT_MESSAGE : null}
        testID="checkout-choice-error"
      />
      <FormError
        message={submit.isError && !hasServerFieldErrors ? getApiErrorMessage(submit.error) : null}
        testID="checkout-error"
      />
      <Button size="lg" loading={submit.isPending} onPress={onConfirm} testID="checkout-confirm">
        Confirmar pedido
      </Button>
    </View>
  );
}
