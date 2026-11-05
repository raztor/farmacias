import { BACKOFFICE_ONLY_MESSAGE } from "@repo/shared";

import { buttonClasses } from "../../components/button-link";
import { StatusScreen } from "../../components/status-screen";
import { SignOutButton } from "./sign-out-button";

type ForbiddenScreenProps = Readonly<{ email: string; residentAppUrl: string | undefined }>;

/**
 * Shown to signed-in residents: the back office is for operators and admins only. Offers the way
 * out to the residents' app (R-ACC-07) when `RESIDENT_APP_URL` is configured, and signing out.
 */
export function ForbiddenScreen({ email, residentAppUrl }: ForbiddenScreenProps) {
  return (
    <StatusScreen
      eyebrow="Sin acceso"
      title="No tienes acceso a la administración"
      description={`Ingresaste como ${email}. ${BACKOFFICE_ONLY_MESSAGE}`}
    >
      {residentAppUrl === undefined ? null : (
        <a href={residentAppUrl} className={buttonClasses("primary")}>
          Ir a la app de vecinos
        </a>
      )}
      <SignOutButton variant={residentAppUrl === undefined ? "primary" : "outline"} size="md" />
    </StatusScreen>
  );
}
