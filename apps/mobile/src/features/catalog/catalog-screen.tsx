import type { ProductCategory } from "@repo/shared";
import { Heading, Text } from "@repo/ui";
import { useRef, useState } from "react";
import { type TextInputInstance, View } from "react-native";

import { AppScreen } from "../../components/app-screen";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { CatalogResults } from "./catalog-results";
import { CatalogSearchBox } from "./catalog-search-box";
import { CategoryFilter } from "./category-filter";

/**
 * Public home (HU-01): search by commercial name or active ingredient, with price and
 * availability. No session needed (HU-01 #3).
 */
export function CatalogScreen() {
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const debouncedTerm = useDebouncedValue(term);
  const inputRef = useRef<TextInputInstance>(null);

  const clearSearch = () => {
    setTerm("");
    setCategory(null);
    inputRef.current?.focus();
  };

  return (
    <AppScreen>
      <View className="gap-2">
        <Heading testID="catalog-title">Catálogo de medicamentos</Heading>
        <Text variant="muted">
          Revisa precios y disponibilidad de la Farmacia Comunitaria de Peñalolén.
        </Text>
      </View>
      <CatalogSearchBox value={term} onChange={setTerm} inputRef={inputRef} />
      <CategoryFilter value={category} onChange={setCategory} />
      <CatalogResults q={debouncedTerm} category={category} onClearSearch={clearSearch} />
    </AppScreen>
  );
}
