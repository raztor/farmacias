import { Heading } from "@repo/ui";

import { AppScreen } from "../../components/app-screen";
import { RequireSignIn, SignOutButton } from "../auth";
import { ProfileSummary } from "./profile-summary";

/** «Mi cuenta»: profile and sign-out, or the sign-in prompt without a session. */
export function AccountScreen() {
  return (
    <AppScreen>
      <Heading testID="account-title">Mi cuenta</Heading>
      <RequireSignIn title="Inicia sesión en tu cuenta">
        <ProfileSummary />
        <SignOutButton />
      </RequireSignIn>
    </AppScreen>
  );
}
