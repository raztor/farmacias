import { describe, expect, it } from "vitest";

import { DOMAIN_CHECK_LISTS, inListFromMigrations } from "./testing/check-constraints";
import { readMigrationsSql } from "./testing/migrations-sql";

const sql = readMigrationsSql();

describe("domain lists of @repo/shared vs the CHECK constraints of the migrations (R-DAT-02)", () => {
  it.each(DOMAIN_CHECK_LISTS)(
    "$constraint allows exactly the shared list",
    ({ constraint, column, values }) => {
      expect(inListFromMigrations(sql, constraint, column)).toEqual([...values]);
    },
  );
});

describe("inListFromMigrations", () => {
  const initial = `ADD CONSTRAINT "t_status_check" CHECK ("status" IN ('a', 'b')),`;

  it("reads the IN list of a nullable column", () => {
    const nullable = `ADD CONSTRAINT "t_kind_check" CHECK ("kind" IS NULL OR "kind" IN ('x', 'y')),`;
    expect(inListFromMigrations(nullable, "t_kind_check", "kind")).toEqual(["x", "y"]);
  });

  it("uses the last definition when a later migration replaces the constraint", () => {
    const replaced = `${initial}\nALTER TABLE "t" DROP CONSTRAINT "t_status_check";\n${initial.replace("'b'", "'b', 'c'")}`;
    expect(inListFromMigrations(replaced, "t_status_check", "status")).toEqual(["a", "b", "c"]);
  });

  it("detects a value missing on the database side", () => {
    expect(inListFromMigrations(initial, "t_status_check", "status")).not.toEqual(["a", "b", "c"]);
  });

  it("returns undefined when the constraint does not exist", () => {
    expect(inListFromMigrations(initial, "t_other_check", "status")).toBeUndefined();
  });
});
