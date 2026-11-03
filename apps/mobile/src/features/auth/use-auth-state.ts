import { authClient } from "../../lib/auth-client";

export type AuthState = Readonly<{
  /** `true` until the stored session has been read (keep the splash screen visible). */
  isPending: boolean;
  isSignedIn: boolean;
}>;

/** Session state for route guards. The Expo plugin restores it from SecureStore on launch. */
export function useAuthState(): AuthState {
  const { data, isPending } = authClient.useSession();
  return { isPending, isSignedIn: data !== null };
}
