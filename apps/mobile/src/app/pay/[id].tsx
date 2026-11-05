import { useLocalSearchParams } from "expo-router";

import { NotFoundScreen } from "../../components/not-found-screen";
import { PaymentScreen } from "../../features/payment";
import { parseRouteId } from "../../lib/route-params";

export default function PaymentRoute() {
  const id = parseRouteId(useLocalSearchParams().id);
  if (id === null) return <NotFoundScreen />;
  return <PaymentScreen orderId={id} />;
}
