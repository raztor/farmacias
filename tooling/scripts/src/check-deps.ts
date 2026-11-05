/**
 * `pnpm check:deps` — enforces the dependency policy (docs/REPO_RULES.md §4).
 */
import { join } from "node:path";

import { checkWorkspace, findUnusedCatalogEntries, limitsFor } from "./lib/deps-rules.ts";
import { report } from "./lib/report.ts";
import { listWorkspaces, readCatalogNames, readPackageJson, REPO_ROOT } from "./lib/workspaces.ts";

const workspaces = listWorkspaces();
const rootPkg = readPackageJson(join(REPO_ROOT, "package.json"));
const rootAsWorkspace = { dir: REPO_ROOT, kind: "tooling" as const, pkg: rootPkg };

const violations = [
  ...workspaces.flatMap(checkWorkspace),
  // The root only checks specifiers (no count limits, no scripts).
  ...checkWorkspace(rootAsWorkspace).filter((v) => v.message.includes("debe usar")),
  ...findUnusedCatalogEntries(workspaces, rootPkg, readCatalogNames()),
];

const summary = workspaces.map((ws) => {
  const limits = limitsFor(ws);
  const external = (deps?: Record<string, string>) =>
    Object.keys(deps ?? {}).filter((name) => !name.startsWith("@repo/")).length;
  return `${ws.pkg.name.padEnd(24)} deps ${String(external(ws.pkg.dependencies)).padStart(2)}/${limits.maxDependencies}  devDeps ${String(external(ws.pkg.devDependencies)).padStart(2)}/${limits.maxDevDependencies}`;
});

process.exitCode = report("Política de dependencias", violations, summary);
