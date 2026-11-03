import { z } from "zod";

import { ROLE_VALUES } from "../constants";

export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 100;

/** Trimmed, lower-cased email address. */
export const emailSchema = z
  .string({ error: "Ingresa tu correo electrónico" })
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX_LENGTH, { error: "El correo es demasiado largo" })
  .pipe(z.email({ error: "Ingresa un correo electrónico válido" }));

/** Password policy for new passwords (sign-up, reset, change). Never trimmed. */
export const passwordSchema = z
  .string({ error: "Ingresa tu contraseña" })
  .min(PASSWORD_MIN_LENGTH, {
    error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    error: `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres`,
  });

/** Display name of a user. */
export const nameSchema = z
  .string({ error: "Ingresa tu nombre" })
  .trim()
  .min(1, { error: "Ingresa tu nombre" })
  .max(NAME_MAX_LENGTH, {
    error: `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres`,
  });

export const roleSchema = z.enum(ROLE_VALUES, { error: "Rol inválido" });

export const updateProfileSchema = z.object({
  name: nameSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
