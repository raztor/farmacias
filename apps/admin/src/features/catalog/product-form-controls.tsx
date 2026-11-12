"use client";

import { PRODUCT_CATEGORIES } from "@repo/shared";
import { useId } from "react";

import {
  CHECKBOX_CLASSES,
  FIELD_CONTROL_CLASSES,
  FIELD_ERROR_CLASSES,
  FIELD_HINT_CLASSES,
  FIELD_LABEL_CLASSES,
} from "../../components/form-styles";
import { categoryLabel } from "./catalog-format";

type CategorySelectProps = Readonly<{
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}>;

/** Native select of the closed category list (`PRODUCT_CATEGORIES`). */
export function CategorySelect({ value, error, onChange }: CategorySelectProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL_CLASSES}>
        Categoría
      </label>
      <select
        id={id}
        value={value}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={FIELD_CONTROL_CLASSES}
      >
        <option value="">Elige una categoría</option>
        {PRODUCT_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {categoryLabel(category)}
          </option>
        ))}
      </select>
      {error === undefined ? null : (
        <p id={errorId} className={FIELD_ERROR_CLASSES}>
          {error}
        </p>
      )}
    </div>
  );
}

type ActiveCheckboxProps = Readonly<{ checked: boolean; onChange: (checked: boolean) => void }>;

/** Active / inactive toggle (R-CAT-13): products are deactivated, never deleted. */
export function ActiveCheckbox({ checked, onChange }: ActiveCheckboxProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-6 flex-row items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-describedby={hintId}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          className={CHECKBOX_CLASSES}
        />
        <span className={FIELD_LABEL_CLASSES}>Producto activo</span>
      </label>
      <p id={hintId} className={FIELD_HINT_CLASSES}>
        Los productos inactivos no aparecen en el catálogo público ni se pueden pedir. No se borran:
        puedes volver a activarlos.
      </p>
    </div>
  );
}
