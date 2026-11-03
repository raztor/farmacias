import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { WorkspaceKind } from "../policy.ts";

export type PackageJson = {
  name: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

export type Workspace = {
  dir: string;
  kind: WorkspaceKind;
  pkg: PackageJson;
};

export const REPO_ROOT = resolve(import.meta.dirname, "../../../..");

const KIND_BY_FOLDER: Record<string, WorkspaceKind> = {
  apps: "app",
  packages: "package",
  tooling: "tooling",
};

export function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

/** Lista los workspaces de apps/*, packages/* y tooling/* (los globs de pnpm-workspace.yaml). */
export function listWorkspaces(root: string = REPO_ROOT): Workspace[] {
  return Object.entries(KIND_BY_FOLDER).flatMap(([folder, kind]) => {
    const base = join(root, folder);
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(base, entry.name))
      .filter((dir) => existsSync(join(dir, "package.json")))
      .map((dir) => ({ dir, kind, pkg: readPackageJson(join(dir, "package.json")) }));
  });
}

/** Lee los nombres declarados en la sección `catalog:` de pnpm-workspace.yaml. */
export function readCatalogNames(root: string = REPO_ROOT): Set<string> {
  const lines = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8").split("\n");
  const names = new Set<string>();
  let inCatalog = false;
  for (const line of lines) {
    if (/^\S/.test(line)) inCatalog = line.startsWith("catalog:");
    const match = inCatalog ? /^ {2}"?([^":#\s][^":]*)"?:\s*\S/.exec(line) : null;
    if (match?.[1]) names.add(match[1]);
  }
  return names;
}
