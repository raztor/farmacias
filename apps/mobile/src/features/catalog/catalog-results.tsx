import { PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@repo/shared";
import { Button, Notice, Text } from "@repo/ui";
import { View } from "react-native";

import { ErrorState, LoadingState } from "../../components/query-state";
import { ProductCard } from "./product-card";
import { useCatalogSearch } from "./use-catalog";

type CatalogResultsProps = Readonly<{
  q: string;
  category: ProductCategory | null;
  onClearSearch: () => void;
}>;

function EmptyResults({ q, category, onClearSearch }: CatalogResultsProps) {
  const term = q.trim();
  const where = category === null ? "" : ` en ${PRODUCT_CATEGORY_LABELS[category]}`;
  const what = term.length > 0 ? `con «${term}»${where}` : `disponibles${where}`;
  return (
    <Notice tone="info" title="No encontramos resultados" testID="catalog-empty">
      <Text>{`No hay productos ${what}. Revisa cómo está escrito o busca por el principio activo.`}</Text>
      <Button variant="outline" onPress={onClearSearch} testID="catalog-empty-clear">
        Modificar la búsqueda
      </Button>
    </Notice>
  );
}

/** Results of the catalog search with loading, error, empty and «load more» states. */
export function CatalogResults(props: CatalogResultsProps) {
  const search = useCatalogSearch(props);

  if (search.isPending) return <LoadingState label="Buscando productos…" />;
  if (search.isError) {
    return (
      <ErrorState
        error={search.error}
        onRetry={() => {
          void search.refetch();
        }}
      />
    );
  }
  const products = search.data.pages.flatMap((page) => page.items);
  if (products.length === 0) return <EmptyResults {...props} />;

  return (
    <View className="gap-3">
      <Text variant="muted" role="status" aria-live="polite" testID="catalog-count">
        {`Mostrando ${String(products.length)} ${products.length === 1 ? "producto" : "productos"}`}
      </Text>
      <View role="list" aria-label="Resultados de la búsqueda" className="gap-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </View>
      {search.hasNextPage ? (
        <Button
          variant="outline"
          loading={search.isFetchingNextPage}
          onPress={() => {
            void search.fetchNextPage();
          }}
          testID="catalog-load-more"
        >
          Ver más productos
        </Button>
      ) : null}
    </View>
  );
}
