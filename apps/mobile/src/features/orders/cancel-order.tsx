import { Button, Notice, Text } from "@repo/ui";
import { useState } from "react";
import { View } from "react-native";

import { FormError } from "../../components/form-error";
import { getApiErrorMessage } from "../../lib/error-message";
import { useCancelOrder } from "./use-orders";

type CancelOrderProps = Readonly<{ orderId: string; version: number; paid: boolean }>;

/** Owner cancellation with an explicit confirmation step (works the same on web and native). */
export function CancelOrder({ orderId, version, paid }: CancelOrderProps) {
  const [confirming, setConfirming] = useState(false);
  const cancel = useCancelOrder();

  if (!confirming) {
    return (
      <Button
        variant="outline"
        onPress={() => {
          setConfirming(true);
        }}
        testID="order-cancel"
      >
        Cancelar pedido
      </Button>
    );
  }
  return (
    <Notice tone="warning" title="¿Quieres cancelar este pedido?" testID="order-cancel-confirm">
      <Text>
        {paid
          ? "El pago simulado ya fue aprobado: al cancelar, las unidades vuelven al inventario."
          : "El pedido quedará cancelado y no podrás pagarlo."}
      </Text>
      <FormError message={cancel.isError ? getApiErrorMessage(cancel.error) : null} />
      <View className="flex-row flex-wrap gap-3">
        <Button
          variant="destructive"
          loading={cancel.isPending}
          onPress={() => {
            cancel.mutate({ id: orderId, expectedVersion: version });
          }}
          testID="order-cancel-yes"
        >
          Sí, cancelar pedido
        </Button>
        <Button
          variant="outline"
          onPress={() => {
            setConfirming(false);
            cancel.reset();
          }}
        >
          No, volver
        </Button>
      </View>
    </Notice>
  );
}
