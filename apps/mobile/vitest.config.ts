import { defineConfig } from "vitest/config";

/**
 * Unit tests of the pure TypeScript modules (error mapping, retry policy, form helpers).
 * They run in Node without the React Native runtime: modules that import `react-native`,
 * Expo or Sentry are not unit-tested here (device flows are covered by Maestro).
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
});
