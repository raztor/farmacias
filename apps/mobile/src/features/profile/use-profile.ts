import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { reportUnexpectedApiError } from "../../lib/report-error";
import { useTRPC } from "../../lib/trpc";

/** Profile of the signed-in user (`user.me`). */
export function useMe() {
  const trpc = useTRPC();
  return useQuery(trpc.user.me.queryOptions());
}

/** Updates the profile and writes the result into the `user.me` cache. */
export function useUpdateProfile() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: (profile) => {
        queryClient.setQueryData(trpc.user.me.queryKey(), profile);
      },
      onError: reportUnexpectedApiError,
    }),
  );
}
