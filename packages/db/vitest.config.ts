import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Integration tests need PostgreSQL: `pnpm test:integration` (vitest.integration.config.ts).
    exclude: ["src/**/*.int.test.ts", "**/node_modules/**", "src/generated/**"],
    restoreMocks: true,
  },
});
