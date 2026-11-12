"use client";

import { Text } from "@repo/ui";

import { ProductForm } from "./product-form";
import { EMPTY_PRODUCT_FORM } from "./product-form.schema";
import { useCreateProduct } from "./use-save-product";

/** Create a product (R-CAT-12): it starts with stock 0 and the default low-stock threshold. */
export function NewProduct() {
  const create = useCreateProduct();

  return (
    <div className="flex flex-col gap-4">
      <Text variant="muted">
        El producto parte sin stock (0 unidades) y con el umbral de stock bajo por defecto. El stock
        se registra después con una recepción en Inventario.
      </Text>
      <ProductForm
        label="Nuevo producto"
        initialValues={EMPTY_PRODUCT_FORM}
        submitLabel="Crear producto"
        submitting={create.isPending}
        onSubmit={(product) => {
          create.mutate(product);
        }}
      />
    </div>
  );
}
