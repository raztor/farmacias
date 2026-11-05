import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Integration tests need PostgreSQL: `pnpm test:integration` (vitest.integration.config.ts).
    exclude: ["src/**/*.int.test.ts", "**/node_modules/**"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/testing/**", "src/**/index.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        // REPO_RULES §8: ≥ 80 % of lines in EACH service. Without `perFile`, Vitest checks the
        // aggregate of every matched file, so an untested service could hide behind the others.
        "src/modules/**/*.service.ts": { lines: 80, perFile: true },
      },
    },
  },
});
