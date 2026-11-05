import { Button, Input } from "@repo/ui";
import type { RefObject } from "react";
import { type TextInputInstance, View } from "react-native";

/** Same limit as `catalog.search` (`q` up to 100 characters). */
const SEARCH_MAX_LENGTH = 100;

type CatalogSearchBoxProps = Readonly<{
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<TextInputInstance | null>;
}>;

/** Search field of the catalog: results update while typing (debounced by the screen). */
export function CatalogSearchBox({ value, onChange, inputRef }: CatalogSearchBoxProps) {
  return (
    <View accessibilityRole="search" className="gap-2">
      <Input
        ref={inputRef}
        label="Buscar medicamento"
        hint="Escribe el nombre comercial o el principio activo, por ejemplo «losartán»."
        placeholder="Ej.: paracetamol"
        value={value}
        onChangeText={onChange}
        maxLength={SEARCH_MAX_LENGTH}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        inputMode="search"
        testID="catalog-search-input"
      />
      {value.length > 0 ? (
        <View className="items-start">
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            testID="catalog-search-clear"
          >
            Limpiar búsqueda
          </Button>
        </View>
      ) : null}
    </View>
  );
}
