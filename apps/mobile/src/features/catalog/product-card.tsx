import type { ProductSummary } from "@repo/api";
import { FOCUS_RING_CLASSES, Text, cn } from "@repo/ui";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { formatClp } from "../../lib/format";
import { AvailabilityBadge } from "./availability-badge";

type ProductCardProps = Readonly<{ product: ProductSummary }>;

/**
 * Search result: name, active ingredient, presentation, price and availability (HU-01 #1).
 * The link takes its accessible name from the visible content (T-09, WCAG 2.5.3 «label in
 * name»): a custom label that reworded the card hid the visible words from voice control.
 */
export function ProductCard({ product }: ProductCardProps) {
  const price = formatClp(product.priceClp);
  return (
    <View role="listitem">
      <Link href={`/product/${product.id}`} asChild>
        <Pressable
          role="link"
          testID={`product-card-${product.id}`}
          className={cn(
            "gap-2 rounded-lg border border-border bg-card p-4 active:opacity-80 dark:border-border-dark dark:bg-card-dark",
            FOCUS_RING_CLASSES,
          )}
        >
          <Text className="text-lg font-semibold">{product.commercialName}</Text>
          <Text variant="muted">{`${product.activeIngredient} · ${product.presentation}`}</Text>
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-lg font-bold" testID="product-card-price">
              {price}
            </Text>
            <AvailabilityBadge
              availability={product.availability}
              availableQty={product.availableQty}
            />
          </View>
        </Pressable>
      </Link>
    </View>
  );
}
