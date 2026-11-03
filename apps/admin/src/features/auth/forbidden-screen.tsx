import { StatusScreen } from "../../components/status-screen";
import { SignOutButton } from "./sign-out-button";

type ForbiddenScreenProps = Readonly<{ email: string }>;

/** Shown to signed-in users without the `admin` role. */
export function ForbiddenScreen({ email }: ForbiddenScreenProps) {
  return (
    <StatusScreen
      eyebrow="403"
      title="Acceso denegado"
      description={`La cuenta ${email} no tiene permisos de administrador. Inicia sesión con otra cuenta o solicita acceso a un administrador.`}
    >
      <SignOutButton variant="primary" size="md" />
    </StatusScreen>
  );
}
