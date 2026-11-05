"use client";

import { useCallback, useState } from "react";
import type { z } from "zod";

import { validateForm, type FieldErrors } from "./form-errors";

type FormValues = Record<string, string>;

/** Props to spread on an `Input` from `@repo/ui`. */
export type FieldProps = Readonly<{
  value: string;
  error: string | undefined;
  onChangeText: (value: string) => void;
}>;

export type UseFormResult<TValues extends FormValues, TOutput> = {
  values: TValues;
  errors: FieldErrors<TValues>;
  /** Updates a field and clears its error. */
  setField: (field: keyof TValues & string, value: string) => void;
  /** `value`, `error` and `onChangeText` for a field. */
  fieldProps: (field: keyof TValues & string) => FieldProps;
  /** Validates every field; returns the parsed data or `null` (and shows the errors). */
  validate: () => TOutput | null;
};

const withoutKey = <T extends Record<string, unknown>>(record: T, key: string): T =>
  Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key)) as T;

/** Minimal controlled-form state validated with a shared zod schema (no form library). */
export function useForm<TSchema extends z.ZodType, TValues extends FormValues>(
  schema: TSchema,
  initialValues: TValues,
): UseFormResult<TValues, z.output<TSchema>> {
  const [values, setValues] = useState<TValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors<TValues>>({});

  const setField = useCallback((field: keyof TValues & string, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] === undefined ? current : withoutKey(current, field)));
  }, []);

  const fieldProps = (field: keyof TValues & string): FieldProps => ({
    value: values[field] ?? "",
    error: errors[field],
    onChangeText: (value: string) => {
      setField(field, value);
    },
  });

  const validate = useCallback((): z.output<TSchema> | null => {
    const result = validateForm(schema, values);
    setErrors(result.success ? {} : result.errors);
    return result.success ? result.data : null;
  }, [schema, values]);

  return { values, errors, setField, fieldProps, validate };
}
