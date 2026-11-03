const WILDCARD = "*";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Converts trusted origins into `@fastify/cors` matchers. Exact origins stay strings; wildcard
 * subdomains (`https://*.example.com`, also accepted by Better Auth) become anchored regexes
 * that match a single DNS label.
 */
export const toCorsOrigins = (origins: readonly string[]): (string | RegExp)[] =>
  [...new Set(origins.map((origin) => origin.trim()))]
    .filter((origin) => origin.length > 0)
    .map((origin) => {
      if (!origin.includes(WILDCARD)) return origin;
      const pattern = origin.split(WILDCARD).map(escapeRegExp).join("[a-z0-9-]+");
      return new RegExp(`^${pattern}$`, "i");
    });
