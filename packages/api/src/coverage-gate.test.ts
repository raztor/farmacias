import { describe, expect, it } from "vitest";

import config from "../vitest.config";

/** REPO_RULES §8 (🔒): `test:coverage` requires ≥ 80 % of lines in each service, not overall. */
describe("coverage gate", () => {
  it("checks the service threshold per file", () => {
    const thresholds = config.test?.coverage?.thresholds as
      Record<string, { lines?: number; perFile?: boolean } | undefined> | undefined;

    expect(thresholds?.["src/modules/**/*.service.ts"]).toEqual({ lines: 80, perFile: true });
  });
});
