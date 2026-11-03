import { Heading, Screen } from "@repo/ui";

import { BackButton } from "../../components/back-button";
import { ProfileEditor } from "../../features/profile";

export default function ProfileRoute() {
  return (
    <Screen scroll contentClassName="gap-6">
      <BackButton />
      <Heading>Editar perfil</Heading>
      <ProfileEditor />
    </Screen>
  );
}
