"use client";

import { captureException } from "@sentry/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { Button, type ButtonProps } from "@repo/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "../../lib/auth-client";
import { SIGN_IN_PATH } from "../../lib/safe-redirect";

type SignOutButtonProps = Readonly<Pick<ButtonProps, "variant" | "size" | "className">>;

/** Ends the session, clears cached data and returns to the sign-in page. */
export function SignOutButton({ variant = "outline", size = "sm", className }: SignOutButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    try {
      const { error } = await authClient.signOut();
      if (error !== null) captureException(new Error(`Sign-out failed: HTTP ${error.status}`));
    } catch (error: unknown) {
      captureException(error);
    } finally {
      // The session cookie may already be gone; leave the private area either way.
      queryClient.clear();
      setPending(false);
      router.replace(SIGN_IN_PATH);
      router.refresh();
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      loading={pending}
      onPress={() => {
        void signOut();
      }}
    >
      Cerrar sesión
    </Button>
  );
}
