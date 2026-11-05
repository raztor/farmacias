"use client";

import { captureException } from "@sentry/nextjs";
import { Button } from "@repo/ui";
import { useEffect } from "react";

import { ButtonLink } from "../components/button-link";
import { StatusScreen } from "../components/status-screen";

type ErrorPageProps = Readonly<{ error: unknown; retry: () => void }>;

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <StatusScreen
      title="Algo salió mal"
      description="Ocurrió un error inesperado. Puedes intentarlo de nuevo o volver al inicio."
    >
      <Button onPress={retry}>Reintentar</Button>
      <ButtonLink href="/" variant="outline">
        Volver al inicio
      </ButtonLink>
    </StatusScreen>
  );
}
