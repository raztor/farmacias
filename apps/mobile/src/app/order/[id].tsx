import { useLocalSearchParams } from "expo-router";

import { NotFoundScreen } from "../../components/not-found-screen";
import { OrderDetailScreen } from "../../features/orders";
import { parseRouteId } from "../../lib/route-params";

export default function OrderRoute() {
  const id = parseRouteId(useLocalSearchParams().id);
  if (id === null) return <NotFoundScreen />;
  return <OrderDetailScreen id={id} />;
}
