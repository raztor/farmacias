import type { z } from "zod";

/** First validation message of each invalid field, keyed by field name. */
export type FieldErrors<TValues> = Partial<Record<keyof TValues & string, string>>;

export type ValidationResult<TOutput, TValues> =
  { success: true; data: TOutput } | { success: false; errors: FieldErrors<TValues> };

/** Validates form values with a shared zod schema and returns one message per field. */
export function validateForm<TSchema extends z.ZodType, TValues extends Record<string, unknown>>(
  schema: TSchema,
  values: TValues,
): ValidationResult<z.output<TSchema>, TValues> {
  const result = schema.safeParse(values);
  if (result.success) return { success: true, data: result.data };

  const errors: FieldErrors<TValues> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && field in values && !(field in errors)) {
      errors[field as keyof TValues & string] = issue.message;
    }
  }
  return { success: false, errors };
}
