import type { OrderDraft } from "@repo/api";
import { Card, CardContent, CardHeader, CardTitle, Text } from "@repo/ui";
import { View } from "react-native";

import { formatClp, formatUnits } from "../../lib/format";

/** Lines and total of the order being confirmed (prices refreshed by the API on confirm). */
export function CheckoutSummary({ draft }: Readonly<{ draft: OrderDraft }>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Resumen</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        <View role="list" aria-label="Productos del pedido" className="gap-2">
          {draft.lines.map((line) => (
            <View
              role="listitem"
              key={line.productId}
              className="flex-row flex-wrap justify-between gap-x-4"
            >
              <Text className="shrink">{`${line.commercialName} × ${String(line.quantity)}`}</Text>
              <Text className="font-medium">{formatClp(line.lineTotalClp)}</Text>
            </View>
          ))}
        </View>
        <Text variant="muted">{formatUnits(draft.itemCount)}</Text>
        <Text className="text-xl font-bold" testID="checkout-total">
          {`Total: ${formatClp(draft.totalClp)}`}
        </Text>
      </CardContent>
    </Card>
  );
}
