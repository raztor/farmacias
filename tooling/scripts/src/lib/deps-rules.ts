import {
  BANNED_PACKAGES,
  CONFIG_ONLY_WORKSPACES,
  DEFAULT_LIMITS,
  INTERNAL_SCOPE,
  LIMIT_OVERRIDES,
  REQUIRED_SCRIPTS,
  type DependencyLimits,
} from "../policy.ts";
import type { Workspace } from "./workspaces.ts";

export type Violation = { workspace: string; message: string };

type Section = "dependencies" | "devDependencies";
const SECTIONS: readonly Section[] = ["dependencies", "devDependencies"];

const isInternal = (name: string): boolean => name.startsWith(INTERNAL_SCOPE);

export function limitsFor(ws: Workspace): DependencyLimits {
  const override = LIMIT_OVERRIDES[ws.pkg.name];
  return { ...DEFAULT_LIMITS[ws.kind], ...override };
}

function checkSpecifiers(ws: Workspace, section: Section): Violation[] {
  const entries = Object.entries(ws.pkg[section] ?? {});
  return entries.flatMap(([name, spec]): Violation[] => {
    const workspace = ws.pkg.name;
    if (isInternal(name) && spec !== "workspace:*") {
      return [{ workspace, message: `${name} debe usar "workspace:*" (tiene "${spec}").` }];
    }
    if (!isInternal(name) && !spec.startsWith("catalog:")) {
      return [{ workspace, message: `${name} debe usar "catalog:" (tiene "${spec}").` }];
    }
    const banned = BANNED_PACKAGES[name];
    return banned ? [{ workspace, message: `${name} está prohibido. ${banned}` }] : [];
  });
}

function checkLimits(ws: Workspace): Violation[] {
  const limits = limitsFor(ws);
  const count = (section: Section) =>
    Object.keys(ws.pkg[section] ?? {}).filter((name) => !isInternal(name)).length;
  const checks: [Section, number][] = [
    ["dependencies", limits.maxDependencies],
    ["devDependencies", limits.maxDevDependencies],
  ];
  return checks
    .filter(([section, max]) => count(section) > max)
    .map(([section, max]) => ({
      workspace: ws.pkg.name,
      message: `${section} externas: ${count(section)} (máximo ${max}). Elimina dependencias o justifica un override en tooling/scripts/src/policy.ts.`,
    }));
}

function checkDuplicates(ws: Workspace): Violation[] {
  const prod = new Set(Object.keys(ws.pkg.dependencies ?? {}));
  return Object.keys(ws.pkg.devDependencies ?? {})
    .filter((name) => prod.has(name))
    .map((name) => ({
      workspace: ws.pkg.name,
      message: `${name} está en dependencies y devDependencies a la vez.`,
    }));
}

function checkManifest(ws: Workspace): Violation[] {
  const violations: Violation[] = [];
  if (ws.pkg.private !== true) {
    violations.push({ workspace: ws.pkg.name, message: `debe declarar "private": true.` });
  }
  if (!ws.pkg.name.startsWith(INTERNAL_SCOPE)) {
    violations.push({
      workspace: ws.pkg.name,
      message: `el nombre debe empezar con ${INTERNAL_SCOPE}.`,
    });
  }
  if (!CONFIG_ONLY_WORKSPACES.has(ws.pkg.name)) {
    for (const script of REQUIRED_SCRIPTS) {
      if (!ws.pkg.scripts?.[script]) {
        violations.push({ workspace: ws.pkg.name, message: `falta el script "${script}".` });
      }
    }
  }
  return violations;
}

/** Catalog entries no workspace uses (they must be removed). */
export function findUnusedCatalogEntries(
  workspaces: Workspace[],
  rootPkg: Workspace["pkg"],
  catalog: Set<string>,
): Violation[] {
  const used = new Set(
    [rootPkg, ...workspaces.map((ws) => ws.pkg)].flatMap((pkg) =>
      SECTIONS.flatMap((section) => Object.keys(pkg[section] ?? {})),
    ),
  );
  return [...catalog]
    .filter((name) => !used.has(name))
    .map((name) => ({
      workspace: "pnpm-workspace.yaml",
      message: `la entrada de catálogo "${name}" no se usa en ningún workspace.`,
    }));
}

export function checkWorkspace(ws: Workspace): Violation[] {
  return [
    ...checkManifest(ws),
    ...SECTIONS.flatMap((section) => checkSpecifiers(ws, section)),
    ...checkLimits(ws),
    ...checkDuplicates(ws),
  ];
}
