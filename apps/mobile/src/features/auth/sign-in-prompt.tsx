import { Button, Notice, Text } from "@repo/ui";
import { Link } from "expo-router";

import { signInHref } from "../../lib/safe-redirect";

type SignInPromptProps = Readonly<{
  /** What needs a session, e.g. «Inicia sesión para ver tu pedido». */
  title: string;
  /** Where to come back after signing in (current path). */
  returnTo: string;
}>;

/** Explains that a screen needs a session and links to sign-in, coming back afterwards. */
export function SignInPrompt({ title, returnTo }: SignInPromptProps) {
  return (
    <Notice tone="info" title={title} testID="sign-in-prompt">
      <Text>
        Ingresa con la cuenta que te entregó la Farmacia Comunitaria. Después volverás a esta
        pantalla.
      </Text>
      <Link href={signInHref(returnTo)} asChild>
        <Button testID="sign-in-prompt-button">Iniciar sesión</Button>
      </Link>
    </Notice>
  );
}
