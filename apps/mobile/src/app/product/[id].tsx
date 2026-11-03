import { useLocalSearchParams } from "expo-router";

import { NotFoundScreen } from "../../components/not-found-screen";
import { ProductDetailScreen } from "../../features/catalog";
import { parseRouteId } from "../../lib/route-params";

export default function ProductRoute() {
  const id = parseRouteId(useLocalSearchParams().id);
  if (id === null) return <NotFoundScreen />;
  return <ProductDetailScreen id={id} />;
}
