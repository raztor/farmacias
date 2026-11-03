import { AuthScreen } from "./auth-screen";
import { SignUpForm } from "./sign-up-form";

export function SignUpScreen() {
  return (
    <AuthScreen
      title="Crear cuenta"
      description="Completa tus datos para comenzar."
      footerText="¿Ya tienes cuenta?"
      footerLinkLabel="Inicia sesión"
      footerHref="/sign-in"
    >
      <SignUpForm />
    </AuthScreen>
  );
}
