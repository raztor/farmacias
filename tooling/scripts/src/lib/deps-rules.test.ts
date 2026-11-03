import { describe, expect, it } from "vitest";

import { checkWorkspace, findUnusedCatalogEntries } from "./deps-rules.ts";
import type { Workspace } from "./workspaces.ts";

const workspace = (pkg: Partial<Workspace["pkg"]>): Workspace => ({
  dir: "/tmp/x",
  kind: "package",
  pkg: { name: "@repo/x", private: true, scripts: { lint: "x", typecheck: "x" }, ...pkg },
});

describe("checkWorkspace", () => {
  it("acepta un paquete que cumple la política", () => {
    const ws = workspace({ dependencies: { zod: "catalog:", "@repo/shared": "workspace:*" } });
    expect(checkWorkspace(ws)).toEqual([]);
  });

  it("exige catalog: para dependencias externas", () => {
    const [violation] = checkWorkspace(workspace({ dependencies: { zod: "^4.0.0" } }));
    expect(violation?.message).toContain('debe usar "catalog:"');
  });

  it("exige workspace:* para dependencias internas", () => {
    const [violation] = checkWorkspace(workspace({ dependencies: { "@repo/db": "^1.0.0" } }));
    expect(violation?.message).toContain('"workspace:*"');
  });

  it("rechaza paquetes prohibidos", () => {
    const [violation] = checkWorkspace(workspace({ dependencies: { lodash: "catalog:" } }));
    expect(violation?.message).toContain("prohibido");
  });

  it("aplica el máximo de dependencias externas sin contar las internas", () => {
    const many = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`dep-${i}`, "catalog:"]));
    const internal = { "@repo/a": "workspace:*", "@repo/b": "workspace:*" };
    const violations = checkWorkspace(workspace({ dependencies: { ...many, ...internal } }));
    expect(violations.map((v) => v.message).join()).toContain(
      "dependencies externas: 9 (máximo 8)",
    );
  });

  it("exige private y scripts obligatorios", () => {
    const messages = checkWorkspace(workspace({ private: false, scripts: {} })).map(
      (v) => v.message,
    );
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining("private"),
        expect.stringContaining('"lint"'),
        expect.stringContaining('"typecheck"'),
      ]),
    );
  });
});

describe("findUnusedCatalogEntries", () => {
  it("detecta entradas del catálogo sin uso", () => {
    const ws = workspace({ dependencies: { zod: "catalog:" } });
    const unused = findUnusedCatalogEntries([ws], { name: "root" }, new Set(["zod", "left-pad"]));
    expect(unused.map((v) => v.message)).toEqual([expect.stringContaining('"left-pad"')]);
  });
});
