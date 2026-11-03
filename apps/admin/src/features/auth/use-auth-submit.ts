"use client";

import { captureException } from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { NETWORK_ERROR_MESSAGE, getAuthErrorMessage, type AuthClientError } from "./auth-errors";

type AuthResult = Readonly<{ error: AuthClientError | null }>;

export type AuthSubmitState = Readonly<{
  /** Form-level error (wrong credentials, rate limit, network…). */
  formError: string | null;
  submitting: boolean;
  /** Runs the auth request and navigates to `redirectTo` when it succeeds. */
  run: (request: () => Promise<AuthResult>) => Promise<void>;
}>;

/** Shared submit flow of the sign-in and sign-up forms. */
export function useAuthSubmit(redirectTo: string): AuthSubmitState {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const run = useCallback(
    async (request: () => Promise<AuthResult>) => {
      setSubmitting(true);
      setFormError(null);
      try {
        const { error } = await request();
        if (error !== null) {
          setFormError(getAuthErrorMessage(error));
          return;
        }
        router.replace(redirectTo);
        router.refresh();
      } catch (error: unknown) {
        // Network errors (API unreachable, offline) are the only ones thrown by the client.
        captureException(error);
        setFormError(NETWORK_ERROR_MESSAGE);
      } finally {
        setSubmitting(false);
      }
    },
    [redirectTo, router],
  );

  return { formError, submitting, run };
}
