"use client";

import type { OperationsOrderDetail } from "@repo/api";
import { Heading, Text } from "@repo/ui";
import Link from "next/link";

import { INLINE_LINK_CLASSES } from "../../components/form-styles";
import { QueryError } from "../../components/query-error";
import { DateTime } from "./date-time";
import { OrderDelivery } from "./order-delivery";
import { OrderHistory } from "./order-history";
import { OrderLines } from "./order-lines";
import { formatClp, fulfillmentLabel, unitsLabel } from "./orders-format";
import { QUEUE_PATH } from "./queue-filters";
import { StatusBadge } from "./status-badge";
import { TransitionPanel } from "./transition-panel";
import { useOrderDetail } from "./use-order-detail";

function BackLink() {
  return (
    <Link href={QUEUE_PATH} className={`${INLINE_LINK_CLASSES} self-start text-sm`}>
      ← Volver a la bandeja
    </Link>
  );
}

function OrderSummary({ order }: Readonly<{ order: OperationsOrderDetail }>) {
  const facts = [
    ["Modalidad", fulfillmentLabel(order.fulfillment)],
    ["Unidades", unitsLabel(order.itemCount)],
    ["Total", formatClp(order.totalClp)],
    ["Creado", <DateTime key="created" value={order.createdAt} />],
    ["Última actualización", <DateTime key="updated" value={order.updatedAt} />],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row flex-wrap items-center gap-3">
        <Heading level={1}>Pedido {order.code}</Heading>
        <StatusBadge status={order.status} className="text-sm" />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-4 md:grid-cols-5">
        {facts.map(([term, value]) => (
          <div key={term} className="flex flex-col">
            <dt className="text-sm text-muted-foreground">{term}</dt>
            <dd className="text-base font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Back-office order detail (R-OPS-05): summary, allowed actions, lines, delivery, history. */
export function OrderDetail({ orderId }: Readonly<{ orderId: string }>) {
  const query = useOrderDetail(orderId);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <Text role="status" variant="muted">
          Cargando pedido…
        </Text>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <Heading level={1}>Pedido</Heading>
        <QueryError
          error={query.error}
          retrying={query.isRefetching}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  }

  const order = query.data;
  return (
    <div className="flex flex-col gap-8" aria-busy={query.isFetching}>
      <BackLink />
      <OrderSummary order={order} />
      <TransitionPanel order={order} />
      <OrderLines lines={order.lines} totalClp={order.totalClp} />
      {order.delivery === null ? null : <OrderDelivery delivery={order.delivery} />}
      <OrderHistory history={order.history} />
    </div>
  );
}
