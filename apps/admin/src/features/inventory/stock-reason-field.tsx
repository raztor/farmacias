import { STOCK_REASON_MAX_LENGTH, STOCK_REASON_MIN_LENGTH } from "@repo/shared";

import {
  FIELD_ERROR_CLASSES,
  FIELD_HINT_CLASSES,
  FIELD_LABEL_CLASSES,
} from "../../components/form-styles";

export const STOCK_REASON_ID = "stock-reason";

type StockReasonFieldProps = Readonly<{
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}>;

/** Mandatory reason of a receipt or adjustment (5 to 280 characters) with a live count. */
export function StockReasonField({ value, error, onChange }: StockReasonFieldProps) {
  const describedBy = `${STOCK_REASON_ID}-hint${error === undefined ? "" : ` ${STOCK_REASON_ID}-error`}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={STOCK_REASON_ID} className={FIELD_LABEL_CLASSES}>
        Motivo (obligatorio)
      </label>
      <textarea
        id={STOCK_REASON_ID}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        rows={3}
        maxLength={STOCK_REASON_MAX_LENGTH}
        required
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        className="rounded-md border border-input bg-background p-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
      />
      <p id={`${STOCK_REASON_ID}-hint`} className={FIELD_HINT_CLASSES}>
        Por ejemplo, «Recepción de proveedor, guía 1234» o «Merma por vencimiento». Entre{" "}
        {STOCK_REASON_MIN_LENGTH} y {STOCK_REASON_MAX_LENGTH} caracteres: {value.length}/
        {STOCK_REASON_MAX_LENGTH}.
      </p>
      {error === undefined ? null : (
        <p id={`${STOCK_REASON_ID}-error`} role="alert" className={FIELD_ERROR_CLASSES}>
          {error}
        </p>
      )}
    </div>
  );
}
