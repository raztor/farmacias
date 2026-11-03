import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { createQueryClient } from "../lib/query-client";
import { setupReactQueryNative } from "../lib/react-query-native";
import { TRPCProvider, createTrpcClient } from "../lib/trpc";

setupReactQueryNative();

type AppProvidersProps = Readonly<{ children: ReactNode }>;

/** App-wide providers: TanStack Query + tRPC. Clients are created once per app instance. */
export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);
  const [trpcClient] = useState(createTrpcClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
