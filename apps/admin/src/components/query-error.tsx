"use client";

import { Button, Text } from "@repo/ui";

import { getTrpcErrorMessage } from "../lib/trpc-errors";

type QueryErrorProps = Readonly<{ error: unknown; retrying: boolean; onRetry: () => void }>;

/** Error of a failed query, in plain Spanish, with a retry button (RNF-09). */
export function QueryError({ error, retrying, onRetry }: QueryErrorProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Text role="alert" className="text-destructive">
        {getTrpcErrorMessage(error)}
      </Text>
      <Button variant="outline" size="sm" loading={retrying} onPress={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
