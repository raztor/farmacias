import type { OrderDraftLine } from "@repo/api";
import { Button, Card, CardContent, QuantityStepper, Text } from "@repo/ui";
import { View } from "react-native";

import { FormError } from "../../components/form-error";
import { getApiErrorMessage } from "../../lib/error-message";
import { formatClp } from "../../lib/format";
import { availabilityWarning, exceedsAvailability, maxLineQuantity } from "./cart-limits";
import { useRemoveItem, useSetQuantity } from "./use-draft";

type CartLineProps = Readonly<{ line: OrderDraftLine }>;

/** One product of the cart: quantity (bounded by stock), subtotal and «Quitar». */
export function CartLine({ line }: CartLineProps) {
  const setQuantity = useSetQuantity();
  const removeItem = useRemoveItem();
  const max = Math.max(1, maxLineQuantity(line.availableQty), line.quantity);
  const error = setQuantity.error ?? removeItem.error;
  const busy = setQuantity.isPending || removeItem.isPending;

  return (
    <Card testID={`cart-line-${line.productId}`}>
      <CardContent className="gap-3 pt-6">
        <View className="gap-1">
          <Text className="text-lg font-semibold">{line.commercialName}</Text>
          <Text variant="muted">{`${line.presentation} · ${formatClp(line.unitPriceClp)} c/u`}</Text>
        </View>
        <QuantityStepper
          value={line.quantity}
          max={max}
          itemLabel={line.commercialName}
          disabled={busy}
          onChange={(quantity) => {
            setQuantity.mutate({ productId: line.productId, quantity });
          }}
          testID={`cart-quantity-${line.productId}`}
        />
        {exceedsAvailability(line) ? (
          <Text role="alert" className="text-warning dark:text-warning-dark">
            {`! ${availabilityWarning(line.availableQty)}`}
          </Text>
        ) : null}
        <FormError message={error === null ? null : getApiErrorMessage(error)} />
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="text-base font-semibold">{`Subtotal: ${formatClp(line.lineTotalClp)}`}</Text>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            accessibilityLabel={`Quitar ${line.commercialName} del pedido`}
            onPress={() => {
              removeItem.mutate({ productId: line.productId });
            }}
            testID={`cart-remove-${line.productId}`}
          >
            Quitar
          </Button>
        </View>
      </CardContent>
    </Card>
  );
}
