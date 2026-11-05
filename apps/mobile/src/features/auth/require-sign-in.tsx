import { usePathname } from "expo-router";
import type { ReactNode } from "react";

import { LoadingState } from "../../components/query-state";
import { SignInPrompt } from "./sign-in-prompt";
import { useAuthState } from "./use-auth-state";

type RequireSignInProps = Readonly<{
  /** Title of the prompt shown without a session. */
  title: string;
  children: ReactNode;
}>;

/**
 * Renders `children` only for a signed-in resident. Without a session it explains why and links
 * to sign-in, which comes back to the current path (browsing the catalog never needs it).
 */
export function RequireSignIn({ title, children }: RequireSignInProps) {
  const { isPending, isSignedIn } = useAuthState();
  const pathname = usePathname();

  if (isPending) return <LoadingState />;
  if (!isSignedIn) return <SignInPrompt title={title} returnTo={pathname} />;
  return children;
}
