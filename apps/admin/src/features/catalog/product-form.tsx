"use client";

import {
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_PRESENTATION_MAX_LENGTH,
  PRODUCT_SKU_MAX_LENGTH,
  type ProductFields,
} from "@repo/shared";
import { Button, Input } from "@repo/ui";
import type { SubmitEvent } from "react";

import { ButtonLink } from "../../components/button-link";
import { useForm, type UseFormResult } from "../../lib/use-form";
import { CATALOG_PATH } from "./catalog-format";
import { ActiveCheckbox, CategorySelect } from "./product-form-controls";
import { productFormSchema, type ProductFormValues } from "./product-form.schema";

type ProductFormState = UseFormResult<ProductFormValues, ProductFields>;

type ProductFieldsGridProps = Readonly<{ form: ProductFormState; onSubmitEditing: () => void }>;

/** Text fields and category of the product, two columns from `sm` up. */
function ProductFieldsGrid({ form, onSubmitEditing }: ProductFieldsGridProps) {
  const { values, errors, setField, fieldProps } = form;
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Input
        label="Nombre comercial"
        {...fieldProps("commercialName")}
        maxLength={PRODUCT_NAME_MAX_LENGTH}
      />
      <Input
        label="Principio activo"
        {...fieldProps("activeIngredient")}
        maxLength={PRODUCT_NAME_MAX_LENGTH}
      />
      <Input
        label="Presentación"
        hint="Por ejemplo: Comprimidos 50 mg x 30"
        {...fieldProps("presentation")}
        maxLength={PRODUCT_PRESENTATION_MAX_LENGTH}
      />
      <CategorySelect
        value={values.category}
        error={errors.category}
        onChange={(value) => {
          setField("category", value);
        }}
      />
      <Input
        label="SKU"
        hint="Código único: letras, números y guiones."
        {...fieldProps("sku")}
        maxLength={PRODUCT_SKU_MAX_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Input
        label="Precio (CLP)"
        hint="En pesos, sin decimales."
        {...fieldProps("priceClp")}
        inputMode="numeric"
        onSubmitEditing={onSubmitEditing}
      />
    </div>
  );
}

type ProductFormProps = Readonly<{
  /** Accessible name of the form, e.g. "Nuevo producto". */
  label: string;
  initialValues: ProductFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (product: ProductFields) => void;
}>;

/**
 * Product data form (HU-11), validated with the shared schema before anything is sent. The API
 * validates again and answers CONFLICT for a SKU already in use.
 */
export function ProductForm(props: ProductFormProps) {
  const { label, initialValues, submitLabel, submitting, onSubmit } = props;
  const form = useForm(productFormSchema, initialValues);

  const submit = () => {
    if (submitting) return;
    const data = form.validate();
    if (data !== null) onSubmit(data);
  };

  const onFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return (
    <form
      noValidate
      aria-label={label}
      onSubmit={onFormSubmit}
      className="flex max-w-2xl flex-col gap-5 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <ProductFieldsGrid form={form} onSubmitEditing={submit} />
      <ActiveCheckbox
        checked={form.values.active === "true"}
        onChange={(checked) => {
          form.setField("active", checked ? "true" : "false");
        }}
      />
      <div className="flex flex-row flex-wrap items-center gap-3">
        <Button onPress={submit} loading={submitting}>
          {submitLabel}
        </Button>
        <ButtonLink href={CATALOG_PATH} variant="outline">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
