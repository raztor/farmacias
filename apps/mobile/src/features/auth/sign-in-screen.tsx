import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

import { LoadingState } from "../../components/query-state";
import { safeRedirect } from "../../lib/safe-redirect";
import { AuthScreen } from "./auth-screen";
import { SignInForm } from "./sign-in-form";
import { useAuthState } from "./use-auth-state";

/**
 * Goes back to the screen that asked for a session: pops the stack down to it when it is
 * already there (no duplicate screen), otherwise replaces the sign-in screen.
 */
function ReturnAfterSignIn({ target }: Readonly<{ target: string }>) {
  const router = useRouter();
  useEffect(() => {
    router.dismissTo(target);
  }, [router, target]);
  return <LoadingState label="Ingresando…" />;
}

/**
 * Sign-in only: accounts are preregistered by the program (there is no public sign-up). Once
 * signed in, goes back to the screen that asked for it (`?redirect=/path`, validated).
 */
export function SignInScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { isSignedIn } = useAuthState();

  if (isSignedIn) return <ReturnAfterSignIn target={safeRedirect(redirect)} />;

  return (
    <AuthScreen
      title="Iniciar sesión"
      description="Ingresa con el correo y la contraseña de tu cuenta de la Farmacia Comunitaria."
      footerText="Las cuentas las crea la Farmacia Comunitaria para las personas inscritas. Si no tienes cuenta o no puedes ingresar, acércate a la farmacia."
    >
      <SignInForm />
    </AuthScreen>
  );
}
