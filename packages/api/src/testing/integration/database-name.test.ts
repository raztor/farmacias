import { describe, expect, it } from "vitest";

import {
  assertIntegrationDatabaseName,
  createIntegrationDatabaseName,
  databaseNameOf,
  INTEGRATION_DATABASE_PREFIX,
  withDatabaseName,
} from "./database-name";
import { parseIntegrationEnv } from "./env";

describe("integration database names", () => {
  it("are unique per run and safe identifiers", () => {
    const a = createIntegrationDatabaseName(1_700_000_000_000, "A1B2C3D4");
    const b = createIntegrationDatabaseName(1_700_000_000_001, "a1b2c3d4");
    expect(a).not.toBe(b);
    expect(a.startsWith(INTEGRATION_DATABASE_PREFIX)).toBe(true);
    expect(assertIntegrationDatabaseName(a)).toBe(a);
  });

  it("refuse names the harness did not generate (never drops a real database)", () => {
    for (const name of ["app", "farmacias", 'farmacias_api_it_x"; DROP', "FARMACIAS_API_IT_1"]) {
      expect(() => assertIntegrationDatabaseName(name)).toThrow(/Refusing/);
    }
  });

  it("point the server URL at the throwaway database keeping credentials and options", () => {
    const name = createIntegrationDatabaseName(1, "ff");
    const url = withDatabaseName(
      "postgresql://app:secret@localhost:5432/app?sslmode=disable",
      name,
    );
    expect(url).toBe(`postgresql://app:secret@localhost:5432/${name}?sslmode=disable`);
    expect(databaseNameOf(url)).toBe(name);
  });
});

describe("integration env", () => {
  it("treats unset or blank variables as disabled", () => {
    expect(parseIntegrationEnv({})).toEqual({});
    expect(parseIntegrationEnv({ TEST_DATABASE_URL: "" }).TEST_DATABASE_URL).toBeUndefined();
  });

  it("accepts PostgreSQL URLs and rejects anything else", () => {
    const env = parseIntegrationEnv({ TEST_DATABASE_URL: " postgresql://app:app@db:5432/app " });
    expect(env.TEST_DATABASE_URL).toBe("postgresql://app:app@db:5432/app");
    expect(() => parseIntegrationEnv({ TEST_DATABASE_URL: "mysql://x@db/app" })).toThrow(
      /TEST_DATABASE_URL/,
    );
  });
});
