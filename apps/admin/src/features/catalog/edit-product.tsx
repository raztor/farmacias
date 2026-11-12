"use client";

import type { AdminProduct } from "@repo/api";
import { Heading, Text } from "@repo/ui";
import Link from "next/link";

import { INLINE_LINK_CLASSES } from "../../components/form-styles";
import { QueryError } from "../../components/query-error";
import { CATALOG_PATH, stockLabel } from "./catalog-format";
import { ProductForm } from "./product-form";
import { productFormValues } from "./product-form.schema";
import { ProductStatusBadge } from "./product-status-badge";
import { useAdminProduct } from "./use-products";
import { useUpdateProduct } from "./use-save-product";

function BackLink() {
  return (
    <Link href={CATALOG_PATH} className={`${INLINE_LINK_CLASSES} self-start text-sm`}>
      ← Volver al catálogo
    </Link>
  );
}

function ProductEditor({ product }: Readonly<{ product: AdminProduct }>) {
  const update = useUpdateProduct();

  return (
    <>
      <div className="flex flex-row flex-wrap items-center gap-3">
        <Heading level={1}>Editar {product.commercialName}</Heading>
        <ProductStatusBadge active={product.active} />
      </div>
      <Text variant="muted">
        Stock actual: {stockLabel(product.onHand)}. El stock y el umbral se gestionan en Inventario.
        Un cambio de precio no modifica los pedidos ya confirmados.
      </Text>
      <ProductForm
        // A fresh form when the stored product changes (e.g. after saving).
        key={product.updatedAt.toISOString()}
        label={`Editar ${product.commercialName}`}
        initialValues={productFormValues(product)}
        submitLabel="Guardar cambios"
        submitting={update.isPending}
        onSubmit={(fields) => {
          update.mutate({ id: product.id, ...fields });
        }}
      />
    </>
  );
}

/** Edit page of a product (R-CAT-13): data, price and active / inactive. */
export function EditProduct({ productId }: Readonly<{ productId: string }>) {
  const query = useAdminProduct(productId);

  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      {query.isPending ? (
        <Text role="status" variant="muted">
          Cargando producto…
        </Text>
      ) : null}
      {query.isError ? (
        <QueryError
          error={query.error}
          retrying={query.isRefetching}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : null}
      {query.data === undefined ? null : <ProductEditor product={query.data} />}
    </div>
  );
}
