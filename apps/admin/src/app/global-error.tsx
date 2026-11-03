"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

import "./globals.css";

type GlobalErrorProps = Readonly<{ error: unknown; retry: () => void }>;

/**
 * Replaces the root layout when it fails, so it renders its own document and avoids the app's
 * providers and React Native components (they may be what failed).
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-background text-foreground">
        <title>Algo salió mal</title>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">Algo salió mal</h1>
          <p className="max-w-md text-muted-foreground">
            Ocurrió un error inesperado. Ya fuimos notificados.
          </p>
          <button
            type="button"
            onClick={retry}
            className="h-11 rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:opacity-90"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
