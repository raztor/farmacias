import type { z } from "zod";

/** Raw environment source: `process.env` or an object with literal `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` reads. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

const formatPath = (path: readonly PropertyKey[]): string =>
  path.length === 0 ? "(root)" : path.map((segment) => String(segment)).join(".");

/** Formats every issue as `  - PATH: message` so all invalid variables are reported at once. */
export const formatEnvIssues = (issues: readonly z.core.$ZodIssue[]): string =>
  issues.map((issue) => `  - ${formatPath(issue.path)}: ${issue.message}`).join("\n");

/**
 * Empty strings are treated as "not set" so optional variables can be left blank in `.env`
 * files (e.g. `SENTRY_DSN=`) and defaults still apply.
 */
const normalizeSource = (source: EnvSource): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, value === "" ? undefined : value]),
  );

/**
 * Validates environment variables against a zod schema.
 *
 * @param schema - usually a `z.object({...})` describing every variable the app reads.
 * @param source - required on purpose: pass `process.env` on the server, or an object with
 *   literal `process.env.NEXT_PUBLIC_X` / `process.env.EXPO_PUBLIC_X` reads so bundlers inline them.
 * @throws Error listing every invalid variable with its path and message.
 */
export const createEnv = <TSchema extends z.ZodType>(
  schema: TSchema,
  source: EnvSource,
): z.output<TSchema> => {
  const result = schema.safeParse(normalizeSource(source));
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${formatEnvIssues(result.error.issues)}`);
  }
  return result.data;
};
