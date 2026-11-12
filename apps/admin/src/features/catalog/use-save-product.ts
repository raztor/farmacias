"use client";

import type { AdminProduct } from "@repo/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { useToast } from "../../components/toast-provider";
import { useTRPC } from "../../lib/trpc";
import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { isSkuTakenError, isStaleProductError } from "./catalog-errors";
import { CATALOG_PATH, productSavedMessage } from "./catalog-format";

/**
 * Shared success / error handling of `catalog.create` and `catalog.update`: refresh the cached
 * lists and the product, confirm with a toast and go back to the list. A SKU already in use is
 * shown on the SKU field by the form (no toast); any other error (stale version, session…) is a
 * toast, and the form keeps what was typed. A stale version also reloads the product so the edit
 * page can offer its current data.
 */
function useSaveCallbacks(kind: "created" | "updated") {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const showToast = useToast();

  return {
    onSuccess: async (product: AdminProduct) => {
      queryClient.setQueryData(trpc.catalog.adminById.queryKey({ id: product.id }), product);
      await queryClient.invalidateQueries(trpc.catalog.adminList.pathFilter());
      showToast({ tone: "success", message: productSavedMessage(product.commercialName, kind) });
      router.push(CATALOG_PATH);
    },
    onError: async (error: unknown) => {
      if (isSkuTakenError(error)) return;
      showToast({ tone: "error", message: getTrpcErrorMessage(error) });
      if (isStaleProductError(error)) {
        await queryClient.invalidateQueries(trpc.catalog.adminById.pathFilter());
      }
    },
  };
}

/** `catalog.create` (admin): a new product with stock 0 and the default threshold. */
export function useCreateProduct() {
  const trpc = useTRPC();
  return useMutation(trpc.catalog.create.mutationOptions(useSaveCallbacks("created")));
}

/** `catalog.update` (admin): data, price and active / inactive, from the loaded version. */
export function useUpdateProduct() {
  const trpc = useTRPC();
  return useMutation(trpc.catalog.update.mutationOptions(useSaveCallbacks("updated")));
}
