"use client";

import { Input } from "@repo/ui";
import { useState } from "react";

import { useDebouncedValue } from "../../lib/use-debounced-value";
import { USER_SEARCH_MAX_LENGTH, userSearchSchema } from "./users.schema";
import { UsersList } from "./users-list";

const SEARCH_DEBOUNCE_MS = 300;

type UsersPanelProps = Readonly<{
  /** Signed-in admin (cannot change their own role). */
  currentUserId: string;
}>;

/** Search box + user list. The search runs on the server (`admin.listUsers`). */
export function UsersPanel({ currentUserId }: UsersPanelProps) {
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);
  const parsed = userSearchSchema.safeParse(debouncedSearch);

  return (
    <div className="flex flex-col gap-6">
      <div role="search" className="max-w-md">
        <Input
          label="Buscar usuarios"
          placeholder="Nombre o correo electrónico"
          value={searchText}
          onChangeText={setSearchText}
          maxLength={USER_SEARCH_MAX_LENGTH}
          autoCapitalize="none"
          autoCorrect={false}
          inputMode="search"
          error={parsed.success ? undefined : parsed.error.issues[0]?.message}
        />
      </div>
      <UsersList search={parsed.success ? parsed.data : undefined} currentUserId={currentUserId} />
    </div>
  );
}
