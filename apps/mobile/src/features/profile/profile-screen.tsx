import { Heading } from "@repo/ui";

import { AppScreen } from "../../components/app-screen";
import { BackButton } from "../../components/back-button";
import { RequireSignIn } from "../auth";
import { ProfileEditor } from "./profile-editor";

/** «Editar perfil». */
export function ProfileScreen() {
  return (
    <AppScreen>
      <BackButton />
      <Heading>Editar perfil</Heading>
      <RequireSignIn title="Inicia sesión para editar tu perfil">
        <ProfileEditor />
      </RequireSignIn>
    </AppScreen>
  );
}
