import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@repo/shared";
import { RadioGroup, RadioOption } from "@repo/ui";
import { View } from "react-native";

type CategoryFilterProps = Readonly<{
  value: ProductCategory | null;
  onChange: (value: ProductCategory | null) => void;
}>;

/** Therapeutic category filter («Todas» = no filter). */
export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  return (
    <RadioGroup label="Filtrar por categoría">
      <View className="flex-row flex-wrap gap-2">
        <RadioOption
          variant="chip"
          label="Todas"
          selected={value === null}
          onSelect={() => {
            onChange(null);
          }}
          testID="category-all"
        />
        {PRODUCT_CATEGORIES.map((category) => (
          <RadioOption
            key={category}
            variant="chip"
            label={PRODUCT_CATEGORY_LABELS[category]}
            selected={value === category}
            onSelect={() => {
              onChange(category);
            }}
            testID={`category-${category}`}
          />
        ))}
      </View>
    </RadioGroup>
  );
}
