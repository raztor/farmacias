import { useCallback, useState } from "react";
import type { z } from "zod";

import { toFieldErrors, type FieldErrors, type FormValues } from "./zod-form-errors";

export type ZodForm<TValues extends FormValues, TOutput> = {
  values: TValues;
  errors: FieldErrors<TValues>;
  setField: (name: keyof TValues, value: string) => void;
  /** Validates every field; returns the parsed output or `null` and shows the errors. */
  validate: () => TOutput | null;
  reset: (values?: TValues) => void;
};

/**
 * Minimal controlled-form state validated with a zod schema (the same schemas the API uses).
 * Errors are shown after submit and cleared field by field while the user edits.
 */
export function useZodForm<TValues extends FormValues, TOutput>(
  schema: z.ZodType<TOutput, TValues>,
  initialValues: TValues,
): ZodForm<TValues, TOutput> {
  const [values, setValues] = useState<TValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors<TValues>>({});

  const setField = useCallback((name: keyof TValues, value: string) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  }, []);

  const validate = useCallback((): TOutput | null => {
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return result.data;
    }
    setErrors(toFieldErrors<TValues>(result.error.issues));
    return null;
  }, [schema, values]);

  const reset = useCallback(
    (next?: TValues) => {
      setValues(next ?? initialValues);
      setErrors({});
    },
    [initialValues],
  );

  return { values, errors, setField, validate, reset };
}
