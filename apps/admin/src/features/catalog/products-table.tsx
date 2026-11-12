"use client";

import type { AdminProduct } from "@repo/api";
import Link from "next/link";

import {
  INLINE_LINK_CLASSES,
  TABLE_CELL_CLASSES,
  TABLE_HEADER_CLASSES,
} from "../../components/form-styles";
import { formatClp } from "../orders";
import { categoryLabel, productHref, stockLabel } from "./catalog-format";
import { ProductStatusBadge } from "./product-status-badge";

function ProductRow({ product }: Readonly<{ product: AdminProduct }>) {
  return (
    <tr className="border-t border-border">
      <td className={TABLE_CELL_CLASSES}>
        <div className="flex flex-col">
          <span className="font-medium">{product.commercialName}</span>
          <span className="text-muted-foreground">
            {product.activeIngredient} · {product.presentation}
          </span>
        </div>
      </td>
      <td className={`hidden md:table-cell ${TABLE_CELL_CLASSES}`}>
        <span className="font-mono text-xs">{product.sku}</span>
      </td>
      <td className={`hidden lg:table-cell ${TABLE_CELL_CLASSES}`}>
        {categoryLabel(product.category)}
      </td>
      <td className={`${TABLE_CELL_CLASSES} whitespace-nowrap text-right`}>
        {formatClp(product.priceClp)}
      </td>
      <td className={`hidden sm:table-cell ${TABLE_CELL_CLASSES} whitespace-nowrap`}>
        {stockLabel(product.onHand)}
      </td>
      <td className={TABLE_CELL_CLASSES}>
        <ProductStatusBadge active={product.active} />
      </td>
      <td className={`${TABLE_CELL_CLASSES} text-right`}>
        <Link href={productHref(product.id)} className={INLINE_LINK_CLASSES}>
          Editar<span className="sr-only"> {product.commercialName}</span>
        </Link>
      </td>
    </tr>
  );
}

/**
 * Product table of the back office. SKU, category and stock are hidden on narrow screens; the
 * wrapper is `relative` so the `sr-only` caption stays inside the scroll box (WCAG 1.4.10).
 */
export function ProductsTable({ products }: Readonly<{ products: readonly AdminProduct[] }>) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
        <caption className="sr-only">Productos del catálogo</caption>
        <thead>
          <tr>
            <th scope="col" className={TABLE_HEADER_CLASSES}>
              Producto
            </th>
            <th scope="col" className={`hidden md:table-cell ${TABLE_HEADER_CLASSES}`}>
              SKU
            </th>
            <th scope="col" className={`hidden lg:table-cell ${TABLE_HEADER_CLASSES}`}>
              Categoría
            </th>
            <th scope="col" className={`${TABLE_HEADER_CLASSES} text-right`}>
              Precio
            </th>
            <th scope="col" className={`hidden sm:table-cell ${TABLE_HEADER_CLASSES}`}>
              Stock
            </th>
            <th scope="col" className={TABLE_HEADER_CLASSES}>
              Estado
            </th>
            <th scope="col" className={TABLE_HEADER_CLASSES}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
