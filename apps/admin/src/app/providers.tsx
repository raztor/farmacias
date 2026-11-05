"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ToastProvider } from "../components/toast-provider";
import { getQueryClient } from "../lib/query-client";
import { ReactNativeWebStyles } from "../lib/react-native-web-styles";
import { TRPCProvider, makeTRPCClient } from "../lib/trpc";

type ProvidersProps = Readonly<{ children: ReactNode }>;

/** Client-side providers: TanStack Query + tRPC, toasts and react-native-web's SSR styles. */
export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(makeTRPCClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <ReactNativeWebStyles />
        <ToastProvider>{children}</ToastProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}
