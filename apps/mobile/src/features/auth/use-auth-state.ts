import { authClient } from "../../lib/auth-client";
import { canUseResidentApp } from "./resident-access";

export type AuthState = Readonly<{
  /** `true` until the stored session has been read (keep the splash screen visible). */
  isPending: boolean;
  /** Signed in with an account that may use this app (role `resident`). */
  isSignedIn: boolean;
}>;

/**
 * Session state for route guards. The Expo plugin restores it from SecureStore on launch.
 * A session of an operator/admin (e.g. a resident promoted after signing in) does not count as
 * signed in: the user is sent back to the sign-in screen, where signing in explains why.
 */
export function useAuthState(): AuthState {
  const { data, isPending } = authClient.useSession();
  return { isPending, isSignedIn: data !== null && canUseResidentApp(data.user) };
}
