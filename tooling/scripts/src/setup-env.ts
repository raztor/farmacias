/**
 * `pnpm run setup` — creates the local .env files from each .env.example (never overwriting
 * existing ones) and generates random secrets wherever it says "change-me".
 */
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { listWorkspaces, REPO_ROOT } from "./lib/workspaces.ts";

const PLACEHOLDER = /change-me/g;

const dirs = [REPO_ROOT, ...listWorkspaces().map((ws) => ws.dir)];

for (const dir of dirs) {
  const example = join(dir, ".env.example");
  const target = join(dir, ".env");
  if (!existsSync(example)) continue;
  const where = relative(REPO_ROOT, target) || ".env";
  if (existsSync(target)) {
    process.stdout.write(`• ${where} ya existe, se mantiene.\n`);
    continue;
  }
  copyFileSync(example, target);
  const content = readFileSync(target, "utf8");
  writeFileSync(
    target,
    content.replace(PLACEHOLDER, () => randomBytes(32).toString("base64url")),
  );
  process.stdout.write(`✔ ${where} creado.\n`);
}
