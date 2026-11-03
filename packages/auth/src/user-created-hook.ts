import type { AppLogger } from "@repo/shared";

/** Public data of a freshly registered user, handed to `onUserCreated`. */
export type CreatedUser = {
  id: string;
  email: string;
  name: string;
};

/** Side effect run after a user is persisted (e.g. enqueue the welcome email). */
export type OnUserCreated = (user: CreatedUser) => void | Promise<void>;

type UserCreatedHookOptions = {
  onUserCreated?: OnUserCreated | undefined;
  logger: AppLogger;
};

/**
 * Builds the `databaseHooks.user.create.after` handler.
 *
 * The user is already persisted when it runs, so a failing side effect must never
 * fail the sign-up request: errors are reported through the logger and swallowed.
 */
export function createUserCreatedHook({ onUserCreated, logger }: UserCreatedHookOptions) {
  return async (user: CreatedUser): Promise<void> => {
    if (!onUserCreated) {
      return;
    }
    const createdUser: CreatedUser = { id: user.id, email: user.email, name: user.name };
    try {
      await onUserCreated(createdUser);
    } catch (error) {
      logger.error({ err: error, userId: createdUser.id }, "onUserCreated hook failed");
    }
  };
}
