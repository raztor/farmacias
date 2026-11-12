"use client";

import { Button, Text } from "@repo/ui";

import { QueryError } from "../../components/query-error";
import { isLoadingCurrentResults } from "../../lib/list-loading";
import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { inventoryResultText, type InventoryFilters } from "./inventory-filters";
import { InventoryTable } from "./inventory-table";
import { useInventoryList } from "./use-inventory";

/**
 * Results of the stock list for the filters in the URL: a persistent live region announces
 * loading, empty and result counts; "Cargar más" fetches the next page.
 */
export function InventoryList({ filters }: Readonly<{ filters: InventoryFilters }>) {
  const query = useInventoryList(filters);
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const failed = query.isError && !query.isFetchNextPageError;
  const loading = isLoadingCurrentResults(query);

  return (
    <section aria-labelledby="inventory-results-title" className="flex flex-col gap-4">
      <h2 id="inventory-results-title" className="sr-only">
        Resultados
      </h2>
      <Text role="status" variant="muted" aria-live="polite">
        {failed
          ? ""
          : inventoryResultText({
              pending: loading,
              count: items.length,
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
      {items.length > 0 ? (
        <div aria-busy={query.isFetching} className={loading ? "opacity-60" : undefined}>
          <InventoryTable items={items} caption="Inventario de productos, por nombre" />
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
          Cargar más productos
        </Button>
      ) : null}
    </section>
  );
}
