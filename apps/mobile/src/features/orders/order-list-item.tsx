import type { MyOrderItem } from "@repo/api";
import { FULFILLMENT_LABELS } from "@repo/shared";
import { FOCUS_RING_CLASSES, Text, cn } from "@repo/ui";
import { Link } from "expo-router";
import { Pressable, View } from "react-native";

import { formatClp, formatDate } from "../../lib/format";
import { OrderStatusBadge } from "./order-status-badge";

/**
 * One row of «Mis pedidos»: code, status, fulfillment, total and date (R-TRK-05). The link is
 * named by its visible content (T-09, WCAG 2.5.3 «label in name»).
 */
export function OrderListItem({ order }: Readonly<{ order: MyOrderItem }>) {
  const fulfillment = order.fulfillment === null ? "" : FULFILLMENT_LABELS[order.fulfillment];
  const total = formatClp(order.totalClp);
  const date = formatDate(order.createdAt);
  return (
    <View role="listitem">
      <Link href={`/order/${order.id}`} asChild>
        <Pressable
          role="link"
          testID={`order-item-${order.code}`}
          className={cn(
            "gap-2 rounded-lg border border-border bg-card p-4 active:opacity-80 dark:border-border-dark dark:bg-card-dark",
            FOCUS_RING_CLASSES,
          )}
        >
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="text-lg font-semibold">{`Pedido ${order.code}`}</Text>
            <OrderStatusBadge status={order.status} label={order.statusLabel} />
          </View>
          <Text variant="muted">{`${fulfillment} · ${date}`}</Text>
          <Text className="font-semibold">{`Total: ${total}`}</Text>
        </Pressable>
      </Link>
    </View>
  );
}
