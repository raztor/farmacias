import type { MyOrderDetail } from "@repo/api";
import { FULFILLMENT_LABELS } from "@repo/shared";
import { Button, Heading, Text } from "@repo/ui";
import { Link } from "expo-router";
import { View } from "react-native";

import { AppScreen } from "../../components/app-screen";
import { BackButton } from "../../components/back-button";
import { ErrorState, LoadingState } from "../../components/query-state";
import { RequireSignIn } from "../auth";
import { CancelOrder } from "./cancel-order";
import { OrderDelivery, OrderHistory, OrderLines } from "./order-detail-sections";
import { OrderStatusBadge } from "./order-status-badge";
import { canCancel, canPay, canRepeat } from "./order-status-view";
import { RepeatOrderButton } from "./repeat-order-button";
import { useOrderDetail } from "./use-orders";

function OrderActions({ order }: Readonly<{ order: MyOrderDetail }>) {
  // Paying and cancelling also require a placed order, so a draft shows no actions.
  if (!canRepeat(order.status)) return null;
  return (
    <View className="gap-3">
      {canPay(order.status) ? (
        <Link href={`/pay/${order.id}`} asChild>
          <Button size="lg" testID="order-go-to-pay">
            {order.status === "payment_rejected"
              ? "Intentar el pago de nuevo"
              : "Ir al pago simulado"}
          </Button>
        </Link>
      ) : null}
      {canRepeat(order.status) ? <RepeatOrderButton order={order} /> : null}
      {canCancel(order.status) ? (
        <CancelOrder
          orderId={order.id}
          version={order.version}
          paid={order.status === "payment_validated"}
        />
      ) : null}
    </View>
  );
}

function OrderDetailContent({ order }: Readonly<{ order: MyOrderDetail }>) {
  const fulfillment = order.fulfillment === null ? null : FULFILLMENT_LABELS[order.fulfillment];
  return (
    <View className="gap-6">
      <View className="gap-2">
        <Heading testID="order-code">{`Pedido ${order.code}`}</Heading>
        <Text variant="label">Estado actual</Text>
        <OrderStatusBadge status={order.status} label={order.statusLabel} testID="order-status" />
        {fulfillment === null ? null : <Text variant="muted">{`Modalidad: ${fulfillment}`}</Text>}
      </View>
      <OrderActions order={order} />
      <OrderHistory order={order} />
      <OrderLines order={order} />
      <OrderDelivery order={order} />
    </View>
  );
}

function OrderDetailBody({ id }: Readonly<{ id: string }>) {
  const order = useOrderDetail(id);
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
  return <OrderDetailContent order={order.data} />;
}

/** Order detail with current status and timeline (HU-09); others' orders are not found. */
export function OrderDetailScreen({ id }: Readonly<{ id: string }>) {
  return (
    <AppScreen>
      <BackButton label="Volver" />
      <RequireSignIn title="Inicia sesión para ver tu pedido">
        <OrderDetailBody id={id} />
      </RequireSignIn>
    </AppScreen>
  );
}
