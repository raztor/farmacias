import { z } from "zod";

/**
 * Parses boolean flags from env strings: "true"/"1" → true, "false"/"0" → false
 * (case-insensitive). Anything else is rejected instead of silently becoming `false`.
 *
 * @example `PRETTY_LOGS: zBooleanString.default(false)`
 */
export const zBooleanString = z.stringbool({
  truthy: ["true", "1"],
  falsy: ["false", "0"],
  error: 'Expected "true", "false", "1" or "0"',
});

/**
 * Parses comma-separated env strings into a trimmed list without empty items.
 *
 * @example `TRUSTED_ORIGINS: zCommaList.pipe(z.array(z.string().min(1)).min(1))`
 */
export const zCommaList = z.string().transform((value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);
