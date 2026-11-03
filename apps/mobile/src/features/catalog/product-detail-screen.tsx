import type { ProductSummary } from "@repo/api";
import { PRODUCT_CATEGORY_LABELS } from "@repo/shared";
import { Card, CardContent, CardHeader, CardTitle, Heading, Text } from "@repo/ui";
import { View } from "react-native";

import { AppScreen } from "../../components/app-screen";
import { BackButton } from "../../components/back-button";
import { ErrorState, LoadingState } from "../../components/query-state";
import { formatClp } from "../../lib/format";
import { AddToOrderPanel } from "../cart";
import { availabilityView } from "./availability";
import { AvailabilityBadge } from "./availability-badge";
import { useProduct } from "./use-catalog";

function DetailRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View className="flex-row flex-wrap justify-between gap-x-4 gap-y-1">
      <Text variant="muted">{label}</Text>
      <Text className="font-medium">{value}</Text>
    </View>
  );
}

function ProductDetail({ product }: Readonly<{ product: ProductSummary }>) {
  return (
    <View className="gap-6">
      <View className="gap-2">
        <Heading testID="product-name">{product.commercialName}</Heading>
        <Text variant="muted">{product.presentation}</Text>
      </View>
      <Card>
        <CardContent className="gap-3 pt-6">
          <Text className="text-2xl font-bold" testID="product-price">
            {formatClp(product.priceClp)}
          </Text>
          <AvailabilityBadge
            availability={product.availability}
            availableQty={product.availableQty}
            testID="product-availability"
          />
          <Text>{availabilityView(product).description}</Text>
          <DetailRow label="Principio activo" value={product.activeIngredient} />
          <DetailRow label="Categoría" value={PRODUCT_CATEGORY_LABELS[product.category]} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle level={2}>Agregar a mi pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <AddToOrderPanel product={product} />
        </CardContent>
      </Card>
    </View>
  );
}

/** Public product detail (HU-01) with «add to order» (HU-03, needs a session). */
export function ProductDetailScreen({ id }: Readonly<{ id: string }>) {
  const product = useProduct(id);

  return (
    <AppScreen>
      <BackButton label="Volver al catálogo" />
      {product.isPending ? <LoadingState /> : null}
      {product.isError ? (
        <ErrorState
          error={product.error}
          onRetry={() => {
            void product.refetch();
          }}
        />
      ) : null}
      {product.isSuccess ? <ProductDetail product={product.data} /> : null}
    </AppScreen>
  );
}
