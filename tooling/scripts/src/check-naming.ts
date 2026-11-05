/**
 * `pnpm check:naming` — checks the names of source files and folders.
 */
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { isValidDirectoryName, isValidFileName } from "./lib/naming-rules.ts";
import { report, type Finding } from "./lib/report.ts";
import { listWorkspaces, REPO_ROOT } from "./lib/workspaces.ts";

/** Source folders checked inside each workspace. */
const SOURCE_DIRS = ["src", "e2e", ".maestro"];
const SKIPPED = new Set(["node_modules", "generated", "__snapshots__"]);

function walk(dir: string): Finding[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry): Finding[] => {
    if (SKIPPED.has(entry.name)) return [];
    const path = join(dir, entry.name);
    const where = relative(REPO_ROOT, path);
    if (entry.isDirectory()) {
      const own = isValidDirectoryName(entry.name)
        ? []
        : [{ workspace: where, message: "la carpeta debe estar en kebab-case." }];
      return [...own, ...walk(path)];
    }
    return isValidFileName(entry.name)
      ? []
      : [{ workspace: where, message: "el archivo debe estar en kebab-case (sufijos con punto)." }];
  });
}

const findings = listWorkspaces().flatMap((ws) =>
  SOURCE_DIRS.flatMap((folder) => walk(join(ws.dir, folder))),
);

process.exitCode = report("Convenciones de nombres", findings);
