import type { z } from "zod";

/** Form values handled by `useZodForm`: every field is a text input. */
export type FormValues = Record<string, string>;

/** First validation message of each invalid field, keyed by field name. */
export type FieldErrors<TValues extends FormValues> = Partial<Record<keyof TValues, string>>;

/** Maps zod issues to one message per top-level field (the first issue of each field wins). */
export function toFieldErrors<TValues extends FormValues>(
  issues: readonly z.core.$ZodIssue[],
): FieldErrors<TValues> {
  const errors: FieldErrors<TValues> = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof TValues | undefined;
    if (field !== undefined && errors[field] === undefined) errors[field] = issue.message;
  }
  return errors;
}
