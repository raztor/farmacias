import type { SignInInput, SignUpInput } from "@repo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "../../lib/auth-client";
import { AuthRequestError } from "./auth-errors";
import { reportUnexpectedAuthError } from "./report-auth-error";

/**
 * Better Auth returns `{ data, error }` instead of throwing; these hooks throw so the error is
 * exposed through TanStack Query. On success the session store updates and the root layout's
 * protected routes switch screens automatically.
 */
export function useSignIn() {
  return useMutation({
    mutationFn: async (input: SignInInput) => {
      const { error } = await authClient.signIn.email(input);
      if (error) throw new AuthRequestError(error);
    },
    onError: reportUnexpectedAuthError,
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: async (input: SignUpInput) => {
      const { error } = await authClient.signUp.email(input);
      if (error) throw new AuthRequestError(error);
    },
    onError: reportUnexpectedAuthError,
  });
}

/** Signs out and drops every cached query so the next user never sees stale data. */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut();
      if (error) throw new AuthRequestError(error);
    },
    onSuccess: () => {
      queryClient.clear();
    },
    onError: reportUnexpectedAuthError,
  });
}
