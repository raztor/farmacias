import type { InputProps } from "@repo/ui";

/** Shared props of the email field (keyboard, autofill, no autocorrect). */
export const EMAIL_INPUT_PROPS = {
  label: "Correo electrónico",
  autoComplete: "email",
  inputMode: "email",
  autoCapitalize: "none",
  autoCorrect: false,
  placeholder: "admin@correo.cl",
} as const satisfies Partial<InputProps>;

/** Shared props of password fields. */
export const PASSWORD_INPUT_PROPS = {
  label: "Contraseña",
  secureTextEntry: true,
  autoCapitalize: "none",
  autoCorrect: false,
} as const satisfies Partial<InputProps>;
