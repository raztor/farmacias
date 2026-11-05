import type { MyOrderDetail } from "@repo/api";
import { Button, Heading, Notice, Text } from "@repo/ui";
import { Link } from "expo-router";
import { View } from "react-native";

import { AppScreen } from "../../components/app-screen";
import { ErrorState, LoadingState } from "../../components/query-state";
import { cachedQueryState } from "../../lib/cached-query-state";
import { RequireSignIn } from "../auth";
import { canPay, useOrderDetail } from "../orders";
import { PaymentPanel } from "./payment-panel";
import { PaymentResult } from "./payment-result";
import { type PaymentController, usePayment } from "./use-payment";

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

type PaymentFlowProps = Readonly<{ order: MyOrderDetail; payment: PaymentController }>;

function PaymentFlow({ order, payment }: PaymentFlowProps) {
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

/** The order could not be refreshed: keep what is on screen and offer to try again. */
function StaleOrderNotice({ onRefresh }: Readonly<{ onRefresh: () => void }>) {
  return (
    <Notice tone="warning" title="No pudimos actualizar el pedido" testID="payment-order-stale">
      <Text>Lo que ves puede no estar al día. Puedes volver a cargarlo cuando quieras.</Text>
      <Button variant="outline" size="sm" onPress={onRefresh} testID="payment-order-refresh">
        Actualizar pedido
      </Button>
    </Notice>
  );
}

function PaymentBody({ orderId }: Readonly<{ orderId: string }>) {
  const order = useOrderDetail(orderId);
  // Above the query guard: a failed order refetch (e.g. the server is unreachable right after an
  // unknown outcome) must never unmount the payment result and its safe «Reintentar» (D-12).
  const payment = usePayment(orderId);
  const state = cachedQueryState(order);
  const refetch = () => {
    void order.refetch();
  };

  if (state.kind === "loading") return <LoadingState />;
  if (state.kind === "error") return <ErrorState error={state.error} onRetry={refetch} />;
  return (
    <View className="gap-4">
      {state.stale ? <StaleOrderNotice onRefresh={refetch} /> : null}
      <PaymentFlow order={state.data} payment={payment} />
    </View>
  );
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
