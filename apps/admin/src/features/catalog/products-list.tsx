"use client";

import type { AdminProductStatus } from "@repo/api";
import { Button, Text } from "@repo/ui";

import { QueryError } from "../../components/query-error";
import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { ProductsTable } from "./products-table";
import { useProductsList } from "./use-products";

type ProductsListProps = Readonly<{
  /** Validated search term (`undefined` = every product). */
  q: string | undefined;
  status: AdminProductStatus;
}>;

const emptyMessage = (q: string | undefined): string =>
  q === undefined ? "No hay productos con ese estado." : `Sin resultados para «${q}».`;

/** Products matching the filters, with cursor-based "load more". */
export function ProductsList({ q, status }: ProductsListProps) {
  const query = useProductsList(q, status);
  const products = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) {
    return (
      <Text role="status" variant="muted">
        Cargando productos…
      </Text>
    );
  }
  if (query.isError && !query.isFetchNextPageError) {
    return (
      <QueryError
        error={query.error}
        retrying={query.isRefetching}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (products.length === 0) {
    return (
      <Text role="status" variant="muted">
        {emptyMessage(q)}
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={query.isFetching}>
      <ProductsTable products={products} />
      <Text role="status" variant="muted">
        {products.length === 1
          ? "Mostrando 1 producto."
          : `Mostrando ${String(products.length)} productos.`}
      </Text>
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
          Cargar más
        </Button>
      ) : null}
    </div>
  );
}
