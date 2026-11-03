"use client";

import { Button, Text } from "@repo/ui";

import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { useUsersList } from "./use-users-list";
import { UsersTable } from "./users-table";

type UsersListProps = Readonly<{
  /** Validated search term (`undefined` = every user). */
  search: string | undefined;
  currentUserId: string;
}>;

type QueryErrorProps = Readonly<{ error: unknown; retrying: boolean; onRetry: () => void }>;

function QueryError({ error, retrying, onRetry }: QueryErrorProps) {
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

/** Users matching `search`, with cursor-based "load more". */
export function UsersList({ search, currentUserId }: UsersListProps) {
  const query = useUsersList(search);
  const users = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) {
    return (
      <Text role="status" variant="muted">
        Cargando usuarios…
      </Text>
    );
  }
  if (query.isError && !query.isFetchNextPageError) {
    return (
      <QueryError
        error={query.error}
        retrying={query.isRefetching}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (users.length === 0) {
    return (
      <Text role="status" variant="muted">
        {search === undefined
          ? "Aún no hay usuarios registrados."
          : `Sin resultados para «${search}».`}
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={query.isFetching}>
      <UsersTable users={users} currentUserId={currentUserId} />
      <Text role="status" variant="muted">
        {users.length === 1 ? "Mostrando 1 usuario." : `Mostrando ${users.length} usuarios.`}
      </Text>
      {query.isFetchNextPageError ? (
        <Text role="alert" className="text-destructive">
          {getTrpcErrorMessage(query.error)}
        </Text>
      ) : null}
      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          loading={query.isFetchingNextPage}
          onPress={() => {
            void query.fetchNextPage();
          }}
        >
          Cargar más
        </Button>
      ) : null}
    </div>
  );
}
