"use client";

import type { AdminProduct } from "@repo/api";
import { Heading, Text } from "@repo/ui";
import Link from "next/link";
import { useState } from "react";

import { buttonClasses } from "../../components/button-link";
import { INLINE_LINK_CLASSES } from "../../components/form-styles";
import { QueryError } from "../../components/query-error";
import { reportSkuTaken } from "./catalog-errors";
import { CATALOG_PATH, isNewerVersion, stockLabel } from "./catalog-format";
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

/** Someone else saved the product while the admin was editing it (R-CAT-18). */
function NewerVersionNotice({ onLoad }: Readonly<{ onLoad: () => void }>) {
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 rounded-md border border-warning bg-background p-4"
    >
      <Text>
        Otra persona guardó cambios en este producto después de que lo abriste. Para guardar los
        tuyos, carga la versión actual (se descartan los cambios que no guardaste).
      </Text>
      <button type="button" onClick={onLoad} className={buttonClasses("outline", "h-9 text-sm")}>
        Cargar la versión actual
      </button>
    </div>
  );
}

/**
 * The form edits the version loaded when the page opened (`base`): a background refetch never
 * resets what the admin is typing. Saving sends that version's `updatedAt`; if the product changed
 * meanwhile the API answers CONFLICT and the newer version can be loaded explicitly.
 */
function ProductEditor({ latest }: Readonly<{ latest: AdminProduct }>) {
  const update = useUpdateProduct();
  const [base, setBase] = useState(latest);

  return (
    <>
      <div className="flex flex-row flex-wrap items-center gap-3">
        <Heading level={1}>Editar {base.commercialName}</Heading>
        <ProductStatusBadge active={base.active} />
      </div>
      <Text variant="muted">
        Stock actual: {stockLabel(latest.onHand)}. El stock y el umbral se gestionan en Inventario.
        Un cambio de precio no modifica los pedidos ya confirmados.
      </Text>
      {isNewerVersion(base, latest) ? (
        <NewerVersionNotice
          onLoad={() => {
            setBase(latest);
          }}
        />
      ) : null}
      <ProductForm
        key={base.updatedAt.toISOString()}
        label={`Editar ${base.commercialName}`}
        initialValues={productFormValues(base)}
        submitLabel="Guardar cambios"
        submitting={update.isPending}
        onSubmit={(fields, reportFieldError) => {
          update.mutate(
            { id: base.id, expectedUpdatedAt: base.updatedAt, ...fields },
            {
              onError: (error) => {
                reportSkuTaken(error, reportFieldError);
              },
            },
          );
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
      {query.isError && query.data === undefined ? (
        <QueryError
          error={query.error}
          retrying={query.isRefetching}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : null}
      {query.data === undefined ? null : <ProductEditor key={productId} latest={query.data} />}
    </div>
  );
}
