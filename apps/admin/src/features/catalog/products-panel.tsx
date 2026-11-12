"use client";

import type { AdminProductStatus } from "@repo/api";
import { Input } from "@repo/ui";
import { useState } from "react";

import { FIELD_CONTROL_CLASSES, FIELD_LABEL_CLASSES } from "../../components/form-styles";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import {
  PRODUCT_SEARCH_MAX_LENGTH,
  PRODUCT_STATUS_FILTERS,
  PRODUCT_STATUS_FILTER_LABELS,
  productSearchSchema,
  toProductStatusFilter,
} from "./product-search.schema";
import { ProductsList } from "./products-list";

const SEARCH_DEBOUNCE_MS = 300;

type StatusSelectProps = Readonly<{
  value: AdminProductStatus;
  onChange: (status: AdminProductStatus) => void;
}>;

function StatusSelect({ value, onChange }: StatusSelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="catalog-status" className={FIELD_LABEL_CLASSES}>
        Estado
      </label>
      <select
        id="catalog-status"
        value={value}
        onChange={(event) => {
          onChange(toProductStatusFilter(event.target.value));
        }}
        className={FIELD_CONTROL_CLASSES}
      >
        {PRODUCT_STATUS_FILTERS.map((status) => (
          <option key={status} value={status}>
            {PRODUCT_STATUS_FILTER_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Search box + status filter + product list. The search runs on the server (`catalog.adminList`). */
export function ProductsPanel() {
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState<AdminProductStatus>("all");
  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  const parsed = productSearchSchema.safeParse(debouncedSearch);

  return (
    <div className="flex flex-col gap-6">
      <div role="search" className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Input
          label="Buscar productos"
          placeholder="Nombre, principio activo o SKU"
          value={searchText}
          onChangeText={setSearchText}
          maxLength={PRODUCT_SEARCH_MAX_LENGTH}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="search"
          containerClassName="sm:w-96"
          error={parsed.success ? undefined : parsed.error.issues[0]?.message}
        />
        <StatusSelect value={status} onChange={setStatus} />
      </div>
      <ProductsList q={parsed.success ? parsed.data : undefined} status={status} />
    </div>
  );
}
