import type { MyOrderDetail } from "@repo/api";
import { Card, CardContent, CardHeader, CardTitle, Text, Timeline } from "@repo/ui";
import { View } from "react-native";

import { formatClp } from "../../lib/format";
import { toTimelineItems } from "./order-status-view";

type SectionProps = Readonly<{ order: MyOrderDetail }>;

/** Products, quantities and total of the order. */
export function OrderLines({ order }: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Productos</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        <View role="list" aria-label="Productos del pedido" className="gap-2">
          {order.lines.map((line) => (
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
        <Text className="text-lg font-bold" testID="order-total">
          {`Total: ${formatClp(order.totalClp)}`}
        </Text>
      </CardContent>
    </Card>
  );
}

/** Synthetic delivery data (only for simulated delivery). */
export function OrderDelivery({ order }: SectionProps) {
  if (order.delivery === null) return null;
  const { sector, addressReference, contactAlias, instructions } = order.delivery;
  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Datos del despacho simulado</CardTitle>
      </CardHeader>
      <CardContent className="gap-1">
        <Text>{`Sector: ${sector}`}</Text>
        <Text>{`Referencia: ${addressReference}`}</Text>
        <Text>{`Contacto: ${contactAlias}`}</Text>
        {instructions === null ? null : <Text>{`Indicaciones: ${instructions}`}</Text>}
      </CardContent>
    </Card>
  );
}

/** Chronological sequence of statuses (HU-09 #1). */
export function OrderHistory({ order }: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Historial del pedido</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline
          label="Historial del pedido, del más antiguo al más reciente"
          items={toTimelineItems(order.timeline)}
          testID="order-timeline"
        />
      </CardContent>
    </Card>
  );
}
