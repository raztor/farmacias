import type { SignInInput } from "@repo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "../../lib/auth-client";
import { AuthRequestError, RESIDENT_APP_ONLY_CODE } from "./auth-errors";
import { reportUnexpectedAuthError } from "./report-auth-error";
import { canUseResidentApp } from "./resident-access";

const HTTP_FORBIDDEN = 403;

/**
 * Better Auth returns `{ data, error }` instead of throwing; these hooks throw so the error is
 * exposed through TanStack Query. On success the session store updates and the root layout's
 * protected routes switch screens automatically.
 *
 * The app is for residents: valid credentials of an operator or admin end the new session at
 * once and explain that they must use the back office (the API would refuse their calls anyway).
 */
export function useSignIn() {
  return useMutation({
    mutationFn: async (input: SignInInput) => {
      const { data, error } = await authClient.signIn.email(input);
      if (error) throw new AuthRequestError(error);
      if (!canUseResidentApp(data.user)) {
        await authClient.signOut();
        throw new AuthRequestError({ code: RESIDENT_APP_ONLY_CODE, status: HTTP_FORBIDDEN });
      }
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
