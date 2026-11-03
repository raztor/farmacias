import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { createPrismaClient } from "../client";
import type { PrismaClient } from "../generated/prisma/client";
import { prismaCliEnv } from "./env";

export type TestDatabase = {
  url: string;
  db: PrismaClient;
  /** Disconnects and drops the database. */
  drop: () => Promise<void>;
};

const PACKAGE_DIR = fileURLToPath(new URL("../..", import.meta.url));
const PRISMA_BIN = fileURLToPath(new URL("../../node_modules/.bin/prisma", import.meta.url));

/**
 * Creates an isolated, uniquely named database on the server of `serverUrl` and applies the
 * versioned migrations with `prisma migrate deploy` (exactly what production runs).
 */
export async function createTestDatabase(serverUrl: string): Promise<TestDatabase> {
  // The name is generated here (never user input); CREATE DATABASE cannot take parameters.
  const name = `farmacias_it_${Date.now().toString()}_${randomBytes(4).toString("hex")}`;
  const admin = createPrismaClient({ databaseUrl: serverUrl });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const databaseUrl = url.toString();
  const drop = async (): Promise<void> => {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.$disconnect();
  };
  try {
    execFileSync(PRISMA_BIN, ["migrate", "deploy"], {
      cwd: PACKAGE_DIR,
      env: prismaCliEnv(databaseUrl),
      stdio: "pipe",
    });
  } catch (error) {
    await drop();
    throw error;
  }
  const db = createPrismaClient({ databaseUrl });
  return {
    url: databaseUrl,
    db,
    drop: async () => {
      await db.$disconnect();
      await drop();
    },
  };
}
