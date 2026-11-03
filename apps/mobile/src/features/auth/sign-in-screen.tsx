import { AuthScreen } from "./auth-screen";
import { SignInForm } from "./sign-in-form";

export function SignInScreen() {
  return (
    <AuthScreen
      title="Iniciar sesión"
      description="Ingresa con tu correo y contraseña."
      footerText="¿No tienes cuenta?"
      footerLinkLabel="Regístrate"
      footerHref="/sign-up"
    >
      <SignInForm />
    </AuthScreen>
  );
}
