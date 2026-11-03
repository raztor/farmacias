import { BACKOFFICE_ONLY_MESSAGE } from "@repo/shared";

import { StatusScreen } from "../../components/status-screen";
import { SignOutButton } from "./sign-out-button";

type ForbiddenScreenProps = Readonly<{ email: string }>;

/** Shown to signed-in residents: the back office is for operators and admins only. */
export function ForbiddenScreen({ email }: ForbiddenScreenProps) {
  return (
    <StatusScreen
      eyebrow="Sin acceso"
      title="No tienes acceso a la administración"
      description={`Ingresaste como ${email}. ${BACKOFFICE_ONLY_MESSAGE}`}
    >
      <SignOutButton variant="primary" size="md" />
    </StatusScreen>
  );
}
