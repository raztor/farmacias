import { z } from "zod";

import { PASSWORD_MAX_LENGTH, emailSchema } from "./user.schema";

/**
 * Sign-in only checks presence: the password policy may change over time and
 * existing passwords must still be accepted.
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Ingresa tu contraseña" })
    .min(1, { error: "Ingresa tu contraseña" })
    .max(PASSWORD_MAX_LENGTH, { error: "Contraseña inválida" }),
});

export type SignInInput = z.infer<typeof signInSchema>;
