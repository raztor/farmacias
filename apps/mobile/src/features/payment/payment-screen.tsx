import type { MyOrderDetail } from "@repo/api";
import { Button, Heading, Notice, Text } from "@repo/ui";
import { Link } from "expo-router";
import { View } from "react-native";

import { AppScreen } from "../../components/app-screen";
import { ErrorState, LoadingState } from "../../components/query-state";
import { RequireSignIn } from "../auth";
import { canPay, useOrderDetail } from "../orders";
import { PaymentPanel } from "./payment-panel";
import { PaymentResult } from "./payment-result";
import { usePayment } from "./use-payment";

function NotPayable({ order }: Readonly<{ order: MyOrderDetail }>) {
  return (
    <Notice tone="info" title="Este pedido no tiene pagos pendientes" testID="payment-not-payable">
      <Text>{`El pedido ${order.code} está en «${order.statusLabel}».`}</Text>
      <Link href={`/order/${order.id}`} replace asChild>
        <Button variant="outline">Ver mi pedido</Button>
      </Link>
    </Notice>
  );
}

function PaymentFlow({ order }: Readonly<{ order: MyOrderDetail }>) {
  const payment = usePayment(order.id);

  if (payment.outcome !== null) {
    return (
      <PaymentResult
        outcome={payment.outcome}
        orderId={order.id}
        onRetry={payment.retry}
        onStartOver={payment.startOver}
      />
    );
  }
  if (!canPay(order.status) && !payment.isPending) return <NotPayable order={order} />;
  return (
    <PaymentPanel
      order={order}
      pendingScenario={payment.scenario}
      isPending={payment.isPending}
      onPay={payment.pay}
    />
  );
}

function PaymentBody({ orderId }: Readonly<{ orderId: string }>) {
  const order = useOrderDetail(orderId);
  if (order.isPending) return <LoadingState />;
  if (order.isError) {
    return (
      <ErrorState
        error={order.error}
        onRetry={() => {
          void order.refetch();
        }}
      />
    );
  }
  return <PaymentFlow order={order.data} />;
}

/** «Pago simulado» (HU-05): explicit approve/reject simulation and its result. */
export function PaymentScreen({ orderId }: Readonly<{ orderId: string }>) {
  return (
    <AppScreen>
      <View className="gap-2">
        <Heading testID="payment-title">Pago simulado</Heading>
        <Text variant="muted">El stock se descuenta solo si el pago se aprueba.</Text>
      </View>
      <RequireSignIn title="Inicia sesión para pagar tu pedido">
        <PaymentBody orderId={orderId} />
      </RequireSignIn>
    </AppScreen>
  );
}
