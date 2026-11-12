"use client";

import type { InventoryItemView } from "@repo/api";
import { LOW_STOCK_THRESHOLD_MAX } from "@repo/shared";
import { useState, type SubmitEvent } from "react";

import { buttonClasses } from "../../components/button-link";
import {
  FIELD_CONTROL_CLASSES,
  FIELD_ERROR_CLASSES,
  FIELD_HINT_CLASSES,
  FIELD_LABEL_CLASSES,
} from "../../components/form-styles";
import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { useForm } from "../../lib/use-form";
import { thresholdFormSchema, thresholdValues } from "./threshold-form";
import { useSetThreshold } from "./use-inventory";

const FIELD_ID = "low-stock-threshold";

type ThresholdFieldProps = Readonly<{
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}>;

function ThresholdField({ value, error, onChange }: ThresholdFieldProps) {
  const describedBy = `${FIELD_ID}-hint${error === undefined ? "" : ` ${FIELD_ID}-error`}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={FIELD_ID} className={FIELD_LABEL_CLASSES}>
        Avisar con estas unidades o menos
      </label>
      <input
        id={FIELD_ID}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={`${FIELD_CONTROL_CLASSES} max-w-32`}
      />
      <p id={`${FIELD_ID}-hint`} className={FIELD_HINT_CLASSES}>
        Entre 0 y {LOW_STOCK_THRESHOLD_MAX}. Con stock en o bajo este número, el producto aparece en
        las alertas.
      </p>
      {error === undefined ? null : (
        <p id={`${FIELD_ID}-error`} role="alert" className={FIELD_ERROR_CLASSES}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Low-stock threshold of a product (HU-12, D-26): integer 0..999. The product enters the alerts
 * when its stock is at or under it. Validation and API errors are announced next to the field.
 */
export function ThresholdEditor({ item }: Readonly<{ item: InventoryItemView }>) {
  const form = useForm(thresholdFormSchema, thresholdValues(item.lowStockThreshold));
  const [apiError, setApiError] = useState<string | null>(null);
  const { mutate, isPending } = useSetThreshold();
  const error = form.errors.threshold ?? apiError ?? undefined;

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError(null);
    const data = form.validate();
    if (data === null) {
      document.getElementById(FIELD_ID)?.focus();
      return;
    }
    mutate(
      { productId: item.productId, threshold: data.threshold },
      {
        onError: (cause) => {
          setApiError(getTrpcErrorMessage(cause));
        },
      },
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="threshold-title"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <h2 id="threshold-title" className="text-lg font-semibold text-foreground">
        Umbral de stock bajo
      </h2>
      <ThresholdField
        value={form.values.threshold}
        error={error}
        onChange={(value) => {
          form.setField("threshold", value);
          setApiError(null);
        }}
      />
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={buttonClasses("outline", "self-start")}
      >
        {isPending ? "Guardando…" : "Guardar umbral"}
      </button>
    </form>
  );
}
