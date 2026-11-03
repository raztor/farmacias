"use client";

import { Button, Text } from "@repo/ui";

import { QueryError } from "../../components/query-error";
import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { queueResultText, type QueueFilters } from "./queue-filters";
import { QueueTable } from "./queue-table";
import { useOrdersQueue } from "./use-orders-queue";

/**
 * Results of the queue for the filters in the URL (HU-07 #1): a persistent live region
 * announces loading, empty and result counts; "Cargar más" fetches the next FIFO page.
 */
export function OrdersQueue({ filters }: Readonly<{ filters: QueueFilters }>) {
  const query = useOrdersQueue(filters);
  const orders = query.data?.pages.flatMap((page) => page.items) ?? [];
  const failed = query.isError && !query.isFetchNextPageError;

  return (
    <section aria-labelledby="queue-results-title" className="flex flex-col gap-4">
      <h2 id="queue-results-title" className="sr-only">
        Resultados
      </h2>
      <Text role="status" variant="muted" aria-live="polite">
        {failed
          ? ""
          : queueResultText({
              pending: query.isPending,
              count: orders.length,
              hasMore: query.hasNextPage,
              filters,
            })}
      </Text>
      {failed ? (
        <QueryError
          error={query.error}
          retrying={query.isRefetching}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : null}
      {orders.length > 0 ? (
        <div aria-busy={query.isFetching} className="flex flex-col gap-4">
          <QueueTable orders={orders} />
        </div>
      ) : null}
      {query.isFetchNextPageError ? (
        <Text role="alert" className="text-destructive">
          {getTrpcErrorMessage(query.error)}
        </Text>
      ) : null}
      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          loading={query.isFetchingNextPage}
          onPress={() => {
            void query.fetchNextPage();
          }}
        >
          Cargar más pedidos
        </Button>
      ) : null}
    </section>
  );
}
