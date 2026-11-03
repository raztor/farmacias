import { Button, Heading, Screen, Text } from "@repo/ui";
import { Link } from "expo-router";

export default function NotFoundRoute() {
  return (
    <Screen contentClassName="items-center justify-center gap-4">
      <Heading level={2}>Página no encontrada</Heading>
      <Text variant="muted" className="text-center">
        La pantalla que buscas no existe o fue movida.
      </Text>
      <Link href="/" replace asChild>
        <Button>Volver al inicio</Button>
      </Link>
    </Screen>
  );
}
