import { Heading, Screen } from "@repo/ui";

import { SignOutButton } from "../../features/auth";
import { ProfileSummary } from "../../features/profile";

export default function HomeRoute() {
  return (
    <Screen scroll contentClassName="gap-6">
      <Heading testID="home-title">Inicio</Heading>
      <ProfileSummary />
      <SignOutButton />
    </Screen>
  );
}
