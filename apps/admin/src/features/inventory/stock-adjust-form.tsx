"use client";

import type { InventoryItemView } from "@repo/api";

import { buttonClasses } from "../../components/button-link";
import {
  FIELD_CONTROL_CLASSES,
  FIELD_ERROR_CLASSES,
  FIELD_HINT_CLASSES,
  FIELD_LABEL_CLASSES,
} from "../../components/form-styles";
import { STOCK_KIND_OPTIONS, deltaHint } from "./stock-adjustment-form";
import { StockReasonField } from "./stock-reason-field";
import { useStockAdjustForm } from "./use-stock-adjust-form";

type KindFieldsetProps = Readonly<{ value: string; onChange: (value: string) => void }>;

function KindFieldset({ value, onChange }: KindFieldsetProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${FIELD_LABEL_CLASSES} mb-1`}>Tipo de movimiento</legend>
      {STOCK_KIND_OPTIONS.map((option) => (
        <label key={option.value} className="flex flex-row items-start gap-2 text-sm">
          <input
            id={`stock-kind-${option.value}`}
            type="radio"
            name="stock-kind"
            value={option.value}
            checked={value === option.value}
            onChange={() => {
              onChange(option.value);
            }}
            className="mt-0.5 h-5 w-5 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span>
            <span className="font-medium text-foreground">{option.label}</span>
            <span className="block text-muted-foreground">{option.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

type DeltaFieldProps = Readonly<{
  value: string;
  hint: string;
  error: string | undefined;
  onChange: (value: string) => void;
}>;

function DeltaField({ value, hint, error, onChange }: DeltaFieldProps) {
  const describedBy = `stock-delta-hint${error === undefined ? "" : " stock-delta-error"}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="stock-delta" className={FIELD_LABEL_CLASSES}>
        Cantidad de unidades
      </label>
      <input
        id="stock-delta"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className={`${FIELD_CONTROL_CLASSES} max-w-48`}
      />
      <p id="stock-delta-hint" className={FIELD_HINT_CLASSES}>
        {hint}
      </p>
      {error === undefined ? null : (
        <p id="stock-delta-error" role="alert" className={FIELD_ERROR_CLASSES}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Receipt or adjustment of one product (HU-10, D-25): the shared schema validates before
 * calling the API (focus goes to the first invalid field); an API rejection (e.g. negative stock)
 * is announced under the form and nothing changes. On success the form is cleared.
 */
export function StockAdjustForm({ item }: Readonly<{ item: InventoryItemView }>) {
  const { values, errors, setField, apiError, isPending, onSubmit } = useStockAdjustForm(
    item.productId,
  );
  const submitLabel = values.kind === "adjustment" ? "Registrar ajuste" : "Registrar recepción";
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="stock-adjust-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <h2 id="stock-adjust-title" className="text-lg font-semibold text-foreground">
        Registrar recepción o ajuste
      </h2>
      <KindFieldset
        value={values.kind}
        onChange={(kind) => {
          setField("kind", kind);
        }}
      />
      <DeltaField
        value={values.delta}
        hint={deltaHint(item.onHand, values)}
        error={errors.delta}
        onChange={(delta) => {
          setField("delta", delta);
        }}
      />
      <StockReasonField
        value={values.reason}
        error={errors.reason}
        onChange={(reason) => {
          setField("reason", reason);
        }}
      />
      {apiError === null ? null : (
        <p role="alert" className={FIELD_ERROR_CLASSES}>
          {apiError}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={buttonClasses("primary", "self-start")}
      >
        {isPending ? "Registrando…" : submitLabel}
      </button>
    </form>
  );
}
