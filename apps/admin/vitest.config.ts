import { defineConfig } from "vitest/config";

/**
 * Unit tests of the pure TypeScript modules (access rules, redirects, error mapping, cache
 * updates, formatting). Components and pages are covered end to end by `@repo/e2e`.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
});
