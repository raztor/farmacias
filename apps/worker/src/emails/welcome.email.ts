import { APP_NAME } from "@repo/shared";

import { escapeHtml } from "./escape-html";
import type { RenderedEmail } from "./rendered-email";

export type WelcomeEmailData = {
  name: string;
};

const layout = (title: string, body: string): string =>
  [
    "<!doctype html>",
    '<html lang="es-CL">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title></head>`,
    '<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5">',
    body,
    "</body>",
    "</html>",
  ].join("\n");

/** Welcome email sent right after sign-up (Spanish, Chile). */
export const renderWelcomeEmail = ({ name }: WelcomeEmailData): RenderedEmail => {
  const subject = `¡Te damos la bienvenida a ${APP_NAME}!`;
  const text = [
    `Hola, ${name}:`,
    "",
    `Gracias por crear tu cuenta en ${APP_NAME}. Ya puedes iniciar sesión y empezar a usarla.`,
    "",
    "Si no fuiste tú quien creó esta cuenta, puedes ignorar este correo.",
    "",
    "Saludos,",
    `El equipo de ${APP_NAME}`,
  ].join("\n");

  const safeName = escapeHtml(name);
  const safeApp = escapeHtml(APP_NAME);
  const html = layout(
    escapeHtml(subject),
    [
      `<h1 style="font-size:20px;margin:0 0 16px">¡Hola, ${safeName}!</h1>`,
      `<p>Gracias por crear tu cuenta en <strong>${safeApp}</strong>. Ya puedes iniciar sesión y empezar a usarla.</p>`,
      '<p style="color:#6b7280;font-size:14px">Si no fuiste tú quien creó esta cuenta, puedes ignorar este correo.</p>',
      `<p>Saludos,<br>El equipo de ${safeApp}</p>`,
    ].join("\n"),
  );

  return { subject, text, html };
};
