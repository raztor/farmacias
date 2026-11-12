"use client";

import {
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_PRESENTATION_MAX_LENGTH,
  PRODUCT_SKU_MAX_LENGTH,
  type ProductFields,
} from "@repo/shared";
import { Button, Input } from "@repo/ui";
import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from "react";

import { ButtonLink } from "../../components/button-link";
import { useForm, type UseFormResult } from "../../lib/use-form";
import { CATALOG_PATH, isCheckboxEnter } from "./catalog-format";
import { ActiveCheckbox, CategorySelect } from "./product-form-controls";
import { productFormSchema, type ProductFormValues } from "./product-form.schema";

type ProductFormState = UseFormResult<ProductFormValues, ProductFields>;

type ProductFieldsGridProps = Readonly<{ form: ProductFormState; onSubmitEditing: () => void }>;

/** Text fields and category of the product, two columns from `sm` up. Enter saves. */
function ProductFieldsGrid({ form, onSubmitEditing }: ProductFieldsGridProps) {
  const { values, errors, setField, fieldProps } = form;
  // react-native-web's TextInput stops the propagation of every keydown, so the form never sees
  // Enter from a text field: each field reports it through `onSubmitEditing` instead.
  const textField = (field: keyof ProductFormValues) => ({
    ...fieldProps(field),
    onSubmitEditing,
  });
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Input
        label="Nombre comercial"
        {...textField("commercialName")}
        maxLength={PRODUCT_NAME_MAX_LENGTH}
      />
      <Input
        label="Principio activo"
        {...textField("activeIngredient")}
        maxLength={PRODUCT_NAME_MAX_LENGTH}
      />
      <Input
        label="Presentación"
        hint="Por ejemplo: Comprimidos 50 mg x 30"
        {...textField("presentation")}
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
        {...textField("sku")}
        maxLength={PRODUCT_SKU_MAX_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Input
        label="Precio (CLP)"
        hint="En pesos, sin decimales. Por ejemplo: 6990 o 6.990"
        {...textField("priceClp")}
        inputMode="numeric"
      />
    </div>
  );
}

/** Error the API found on a field after submitting (shown inline, R-CAT-13). */
export type ReportFieldError = (field: "sku", message: string) => void;

type ProductFormProps = Readonly<{
  /** Accessible name of the form, e.g. "Nuevo producto". */
  label: string;
  initialValues: ProductFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (product: ProductFields, reportFieldError: ReportFieldError) => void;
}>;

/**
 * Moves the focus to the first invalid control after each failed attempt (`aria-invalid`, set by
 * the `@repo/ui` inputs and the category select), so keyboard and screen reader users land on it.
 */
function useFocusFirstInvalid() {
  const formRef = useRef<HTMLFormElement>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (attempt === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempt]);
  return {
    formRef,
    focusFirstInvalid: () => {
      setAttempt((current) => current + 1);
    },
  };
}

/**
 * Product data form (HU-11), validated with the shared schema before anything is sent. The API
 * validates again; a SKU already in use comes back as an error on the SKU field.
 */
export function ProductForm(props: ProductFormProps) {
  const { label, initialValues, submitLabel, submitting, onSubmit } = props;
  const form = useForm(productFormSchema, initialValues);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();

  const submit = () => {
    if (submitting) return;
    const data = form.validate();
    if (data === null) {
      focusFirstInvalid();
      return;
    }
    onSubmit(data, (field, message) => {
      form.setFieldError(field, message);
      focusFirstInvalid();
    });
  };

  const onFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  // Enter in the «Producto activo» box saves too. Text fields never reach this handler (their
  // keydown does not propagate, see `ProductFieldsGrid`), so a key press never submits twice; the
  // select keeps Enter for its own list.
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (!isCheckboxEnter(event.key, event.target, event.nativeEvent.isComposing)) return;
    event.preventDefault();
    submit();
  };

  return (
    <form
      ref={formRef}
      noValidate
      aria-label={label}
      onSubmit={onFormSubmit}
      onKeyDown={onKeyDown}
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
