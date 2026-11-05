import { Button, Heading, Notice, Text } from "@repo/ui";
import { Link } from "expo-router";
import { View } from "react-native";

import { AppScreen } from "../../components/app-screen";
import { ErrorState, LoadingState } from "../../components/query-state";
import { RequireSignIn } from "../auth";
import { OrderListItem } from "./order-list-item";
import { useMyOrders } from "./use-orders";

function MyOrdersList() {
  const orders = useMyOrders();
  if (orders.isPending) return <LoadingState />;
  if (orders.isError) {
    return (
      <ErrorState
        error={orders.error}
        onRetry={() => {
          void orders.refetch();
        }}
      />
    );
  }
  const items = orders.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <Notice tone="info" title="Aún no tienes pedidos confirmados" testID="orders-empty">
        <Text>Cuando confirmes un pedido, aquí podrás seguir su estado.</Text>
        <Link href="/" asChild>
          <Button variant="outline">Ir al catálogo</Button>
        </Link>
      </Notice>
    );
  }
  return (
    <View className="gap-3">
      <View role="list" aria-label="Tus pedidos" className="gap-3">
        {items.map((order) => (
          <OrderListItem key={order.id} order={order} />
        ))}
      </View>
      {orders.hasNextPage ? (
        <Button
          variant="outline"
          loading={orders.isFetchingNextPage}
          onPress={() => {
            void orders.fetchNextPage();
          }}
        >
          Ver pedidos anteriores
        </Button>
      ) : null}
    </View>
  );
}

/** «Mis pedidos» (HU-09): own orders, newest first; the cart lives in «Mi pedido». */
export function MyOrdersScreen() {
  return (
    <AppScreen>
      <View className="gap-2">
        <Heading testID="orders-title">Mis pedidos</Heading>
        <Text variant="muted">Revisa el estado y el historial de tus pedidos.</Text>
      </View>
      <RequireSignIn title="Inicia sesión para ver tus pedidos">
        <MyOrdersList />
      </RequireSignIn>
    </AppScreen>
  );
}
