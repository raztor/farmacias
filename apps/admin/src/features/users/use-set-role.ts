"use client";

import type { Role } from "@repo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../components/toast-provider";
import { useTRPC } from "../../lib/trpc";
import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { findUserRole, withUser, withUserRole, type UsersInfiniteData } from "./users-cache";
import { roleChangeMessage } from "./users-format";

type RollbackContext = Readonly<{ previousRole: Role | null }>;

/**
 * `admin.setRole` with optimistic UI: every cached `admin.listUsers` page shows the new role
 * immediately; on failure only that user's role is rolled back (concurrent changes to other
 * rows are kept) and an error toast explains why.
 */
export function useSetRole() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const showToast = useToast();
  const listFilter = trpc.admin.listUsers.infiniteQueryFilter();

  const setCachedRole = (userId: string, role: Role) => {
    queryClient.setQueriesData<UsersInfiniteData>(listFilter, (data) =>
      data === undefined ? data : withUserRole(data, userId, role),
    );
  };

  return useMutation(
    trpc.admin.setRole.mutationOptions<RollbackContext>({
      onMutate: async ({ userId, role }) => {
        await queryClient.cancelQueries(listFilter);
        const cached = queryClient.getQueriesData<UsersInfiniteData>(listFilter);
        const previousRole = cached
          .map(([, data]) => findUserRole(data, userId))
          .find((value) => value !== null);
        setCachedRole(userId, role);
        return { previousRole: previousRole ?? null };
      },
      onError: (error, { userId }, context) => {
        if (context?.previousRole != null) setCachedRole(userId, context.previousRole);
        showToast({ tone: "error", message: getTrpcErrorMessage(error) });
      },
      onSuccess: (user) => {
        queryClient.setQueriesData<UsersInfiniteData>(listFilter, (data) =>
          data === undefined ? data : withUser(data, user),
        );
        showToast({ tone: "success", message: roleChangeMessage(user.name, user.role) });
      },
    }),
  );
}
