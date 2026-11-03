import { Button, Heading, Text } from "@repo/ui";
import { Link } from "expo-router";

import { AppScreen } from "./app-screen";

/** Unknown route or invalid id in the URL. */
export function NotFoundScreen() {
  return (
    <AppScreen>
      <Heading level={2}>Página no encontrada</Heading>
      <Text variant="muted">La pantalla que buscas no existe o fue movida.</Text>
      <Link href="/" replace asChild>
        <Button>Ir al catálogo</Button>
      </Link>
    </AppScreen>
  );
}
