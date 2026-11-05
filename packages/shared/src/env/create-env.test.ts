import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createEnv } from "./create-env";
import { zBooleanString, zCommaList } from "./env-helpers";

const schema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(4000),
  SENTRY_DSN: z.url().optional(),
  PRETTY_LOGS: zBooleanString.default(false),
  TRUSTED_ORIGINS: zCommaList,
});

describe("createEnv", () => {
  it("returns parsed and typed values", () => {
    const env = createEnv(schema, {
      DATABASE_URL: "postgresql://app:app@localhost:5432/app",
      PORT: "4001",
      PRETTY_LOGS: "true",
      TRUSTED_ORIGINS: "http://localhost:8081, bnp://",
    });

    expect(env).toEqual({
      DATABASE_URL: "postgresql://app:app@localhost:5432/app",
      PORT: 4001,
      PRETTY_LOGS: true,
      TRUSTED_ORIGINS: ["http://localhost:8081", "bnp://"],
    });
  });

  it("treats empty strings as unset so defaults and optionals apply", () => {
    const env = createEnv(schema, {
      DATABASE_URL: "postgresql://localhost/app",
      PORT: "",
      SENTRY_DSN: "",
      PRETTY_LOGS: "",
      TRUSTED_ORIGINS: "a",
    });

    expect(env.PORT).toBe(4000);
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.PRETTY_LOGS).toBe(false);
  });

  it("ignores variables that are not part of the schema", () => {
    const env = createEnv(z.object({ A: z.string() }), { A: "1", B: "2" });
    expect(env).toEqual({ A: "1" });
  });

  it("throws a single error listing every invalid variable", () => {
    const run = () => createEnv(schema, { PORT: "abc", PRETTY_LOGS: "maybe" });

    expect(run).toThrow(Error);
    expect(run).toThrow(/^Invalid environment variables:\n/);
    let message = "";
    try {
      run();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("  - DATABASE_URL: ");
    expect(message).toContain("  - PORT: ");
    expect(message).toContain("  - PRETTY_LOGS: ");
    expect(message).toContain("  - TRUSTED_ORIGINS: ");
    expect(message).not.toContain("SENTRY_DSN");
  });

  it("reports nested paths and root-level issues", () => {
    expect(() =>
      createEnv(z.object({ LIST: zCommaList.pipe(z.array(z.url())) }), { LIST: "ok,nope" }),
    ).toThrow(/ {2}- LIST\.0: /);
    expect(() => createEnv(z.string(), {})).toThrow(/ {2}- \(root\): /);
  });
});
