import type { MyOrderDetail } from "@repo/api";
import { Button } from "@repo/ui";
import { View } from "react-native";

import { FormError } from "../../components/form-error";
import { getApiErrorMessage } from "../../lib/error-message";
import { useRepeatOrder } from "./use-orders";

/** "Repetir pedido" (HU-14): adds this order's products to the cart and opens it. */
export function RepeatOrderButton({ order }: Readonly<{ order: MyOrderDetail }>) {
  const repeat = useRepeatOrder({ code: order.code, lineCount: order.lines.length });
  return (
    <View className="gap-2">
      <Button
        variant="outline"
        loading={repeat.isPending}
        accessibilityHint="Agrega los productos de este pedido a tu carrito"
        onPress={() => {
          repeat.mutate({ orderId: order.id });
        }}
        testID="order-repeat"
      >
        Repetir pedido
      </Button>
      <FormError
        message={repeat.isError ? getApiErrorMessage(repeat.error) : null}
        testID="order-repeat-error"
      />
    </View>
  );
}
