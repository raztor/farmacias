import { z } from "zod";

/** Same limit as the API's `admin.listUsers` input. */
export const USER_SEARCH_MAX_LENGTH = 100;

/** Search box value: trimmed; blank means "no filter". */
export const userSearchSchema = z
  .string()
  .trim()
  .max(USER_SEARCH_MAX_LENGTH, { error: `Máximo ${USER_SEARCH_MAX_LENGTH} caracteres.` })
  .transform((value) => (value === "" ? undefined : value));
