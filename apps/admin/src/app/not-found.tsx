import type { Metadata } from "next";

import { ButtonLink } from "../components/button-link";
import { StatusScreen } from "../components/status-screen";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <StatusScreen
      eyebrow="404"
      title="Página no encontrada"
      description="La página que buscas no existe o fue movida."
    >
      <ButtonLink href="/">Volver al inicio</ButtonLink>
    </StatusScreen>
  );
}
