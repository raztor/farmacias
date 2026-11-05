import type { MyOrderDetail } from "@repo/api";
import { Button, Card, CardContent, Notice, Text } from "@repo/ui";
import { View } from "react-native";

import { formatClp } from "../../lib/format";
import { OrderStatusBadge } from "../orders";
import { type PaymentScenario, paymentAttempts, pendingAttemptHint } from "./payment-attempts";

type PaymentPanelProps = Readonly<{
  order: MyOrderDetail;
  pendingScenario: PaymentScenario | null;
  isPending: boolean;
  onPay: (scenario: PaymentScenario) => void;
}>;

/** Order summary and the two explicit simulation buttons (HU-05). */
export function PaymentPanel({ order, pendingScenario, isPending, onPay }: PaymentPanelProps) {
  const pendingHint = isPending ? null : pendingAttemptHint(paymentAttempts.pending(order.id));
  return (
    <View className="gap-5">
      <Card>
        <CardContent className="gap-2 pt-6">
          <Text className="text-lg font-semibold">{`Pedido ${order.code}`}</Text>
          <OrderStatusBadge status={order.status} label={order.statusLabel} />
          <Text className="text-2xl font-bold" testID="payment-total">
            {`Total a pagar: ${formatClp(order.totalClp)}`}
          </Text>
        </CardContent>
      </Card>
      {order.status === "payment_rejected" ? (
        <Notice tone="destructive" title="Tu pago anterior fue rechazado">
          <Text>Puedes intentarlo de nuevo. El inventario no cambió.</Text>
        </Notice>
      ) : null}
      {pendingHint === null ? null : (
        <Notice tone="warning" title="Hay un pago sin confirmar" testID="payment-pending-attempt">
          <Text>{pendingHint}</Text>
        </Notice>
      )}
      <Text>
        Esto es una simulación: no se cobra dinero real. Elige qué resultado quieres simular.
      </Text>
      <Button
        size="lg"
        loading={isPending && pendingScenario === "approve"}
        disabled={isPending}
        onPress={() => {
          onPay("approve");
        }}
        testID="pay-approve"
      >
        Simular pago aprobado
      </Button>
      <Button
        size="lg"
        variant="outline"
        loading={isPending && pendingScenario === "reject"}
        disabled={isPending}
        onPress={() => {
          onPay("reject");
        }}
        testID="pay-reject"
      >
        Simular pago rechazado
      </Button>
    </View>
  );
}
