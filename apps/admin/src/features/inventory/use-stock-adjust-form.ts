"use client";

import { useState, type SubmitEvent } from "react";

import { validateForm } from "../../lib/form-errors";
import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { useForm } from "../../lib/use-form";
import {
  EMPTY_STOCK_ADJUSTMENT,
  STOCK_ADJUSTMENT_FIELDS,
  stockAdjustmentFormSchema,
  toAdjustInput,
} from "./stock-adjustment-form";
import { STOCK_REASON_ID } from "./stock-reason-field";
import { useAdjustStock } from "./use-inventory";

/** DOM id of the control that receives focus when a field is invalid. */
const FIELD_IDS = { kind: "stock-kind-receipt", delta: "stock-delta", reason: STOCK_REASON_ID };

/**
 * State of the receipt / adjustment form (HU-10): validates with the shared schema and focuses
 * the first invalid field; sends `inventory.adjust`; keeps the API's rejection (e.g. negative
 * stock) to announce it under the form; clears quantity and reason on success.
 */
export function useStockAdjustForm(productId: string) {
  const form = useForm(stockAdjustmentFormSchema, EMPTY_STOCK_ADJUSTMENT);
  const [apiError, setApiError] = useState<string | null>(null);
  const { mutate, isPending } = useAdjustStock();
  const { values, setField } = form;

  const focusFirstInvalid = () => {
    const result = validateForm(stockAdjustmentFormSchema, values);
    if (result.success) return;
    const invalid = STOCK_ADJUSTMENT_FIELDS.find((field) => result.errors[field] !== undefined);
    if (invalid !== undefined) document.getElementById(FIELD_IDS[invalid])?.focus();
  };

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError(null);
    const data = form.validate();
    if (data === null) {
      focusFirstInvalid();
      return;
    }
    mutate(toAdjustInput(productId, data), {
      onSuccess: () => {
        setField("delta", "");
        setField("reason", "");
      },
      onError: (error) => {
        setApiError(getTrpcErrorMessage(error));
      },
    });
  };

  return { values, errors: form.errors, setField, apiError, isPending, onSubmit };
}
