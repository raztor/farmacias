"use client";

import { Button, Text } from "@repo/ui";

import { getTrpcErrorMessage } from "../lib/trpc-errors";

type QueryErrorProps = Readonly<{
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  /** `false` hides «Reintentar» (e.g. invalid input: retrying gives the same error). */
  canRetry?: boolean;
}>;

/** Error of a failed query, in plain Spanish, with a retry button (RNF-09). */
export function QueryError({ error, retrying, onRetry, canRetry = true }: QueryErrorProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Text role="alert" className="text-destructive">
        {getTrpcErrorMessage(error)}
      </Text>
      {canRetry ? (
        <Button variant="outline" size="sm" loading={retrying} onPress={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}
