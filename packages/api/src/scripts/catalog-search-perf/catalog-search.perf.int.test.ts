import { writeFile } from "node:fs/promises";

import { buildCatalogProducts, seedCatalog, type PrismaClient } from "@repo/db";
import { buildProductSearchText, noopLogger } from "@repo/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCaller, type CatalogSearchInput } from "../../index";
import { createTestDeps } from "../../testing/fakes";
import {
  disconnectTestDb,
  getTestDb,
  INTEGRATION_ENABLED,
  resetDatabase,
} from "../../testing/integration";
import { createTRPCContext } from "../../trpc";
import { summarizeLatencies, type LatencyStats } from "./latency-stats";
import { P95_TARGET_MS, parsePerfConfig } from "./perf-config";
import { replicateCatalog } from "./replicate-catalog";

/**
 * T-10 · RNF-04: p95 of `catalog.search` < 2 s on the agreed volume.
 *
 * Seeds the synthetic catalog × CATALOG_PERF_REPLICAS through the real seed (`seedCatalog`),
 * runs ANALYZE, then calls `catalog.search` anonymously through the full tRPC procedure stack
 * (zod input, middlewares, service, repository, PostgreSQL) for every search of SEARCHES,
 * CATALOG_PERF_ROUNDS times, and reports p50/p95/p99. Method and results:
 * docs/validation/rendimiento-buscador.md.
 */

const config = parsePerfConfig(process.env);
const HOOK_TIMEOUT_MS = 10 * 60 * 1000;
const SEED_CHUNK_SIZE = 500;

type Search = { label: string; input: CatalogSearchInput };

/** Realistic resident queries plus worst cases (very broad, empty, no results, page 2). */
const SEARCHES: readonly Search[] = [
  ...[
    "losartan",
    "LOSARTÁN",
    "pregabalina",
    "melatonina",
    "multivitaminico",
    "celecoxib 200",
    "escitalopram",
    "paracetamol",
    "omeprazol",
    "atorvastatina",
    "sertra",
    "tensivar",
    "ácido",
    "comprimidos",
    "mg",
    "a",
    "zzz inexistente",
  ].map((q) => ({ label: q, input: { q } })),
  { label: "(sin término)", input: {} },
  { label: "pregabalina + categoría", input: { q: "pregabalina", category: "salud-mental" } },
  { label: "vitamina (50 por página)", input: { q: "vitamina", limit: 50 } },
];

type PerfReport = {
  generatedAt: string;
  postgres: string;
  products: number;
  replicas: number;
  rounds: number;
  targetP95Ms: number;
  overall: LatencyStats;
  searches: { label: string; resultsFirstPage: number; stats: LatencyStats }[];
  plan: string[];
};

const anonymousCaller = async (db: PrismaClient) =>
  createCaller(
    await createTRPCContext({
      deps: { ...createTestDeps({ session: null, logger: noopLogger }), db },
      headers: new Headers(),
      requestId: "catalog-perf",
    }),
  );

type Caller = Awaited<ReturnType<typeof anonymousCaller>>;

const timeSearch = async (caller: Caller, input: CatalogSearchInput) => {
  const startedAt = performance.now();
  const result = await caller.catalog.search(input);
  return { elapsedMs: performance.now() - startedAt, results: result.items.length };
};

/** Second page of a broad term: exercises the keyset cursor. */
const withSecondPage = async (caller: Caller): Promise<Search[]> => {
  const first = await caller.catalog.search({ q: "comprimidos" });
  const cursor = first.nextCursor ?? undefined;
  return [...SEARCHES, { label: "comprimidos (página 2)", input: { q: "comprimidos", cursor } }];
};

const queryPlan = async (db: PrismaClient): Promise<string[]> => {
  const rows = await db.$queryRaw<{ "QUERY PLAN": string }[]>`
    EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)
    SELECT id FROM products WHERE active AND search_text LIKE '%losartan%'`;
  return rows.map((row) => row["QUERY PLAN"]);
};

describe.skipIf(!INTEGRATION_ENABLED)("catalog.search performance (T-10, RNF-04)", () => {
  const db = INTEGRATION_ENABLED ? getTestDb() : undefined;
  const testDb = () => {
    if (!db) throw new Error("integration disabled");
    return db;
  };
  let products = 0;

  beforeAll(async () => {
    await resetDatabase(testDb());
    const catalog = replicateCatalog(buildCatalogProducts(), config.CATALOG_PERF_REPLICAS);
    // seedCatalog runs one batch transaction (Prisma's 5 s limit): seed in chunks.
    for (let start = 0; start < catalog.length; start += SEED_CHUNK_SIZE) {
      const chunk = catalog.slice(start, start + SEED_CHUNK_SIZE);
      await seedCatalog(testDb(), { buildSearchText: buildProductSearchText, products: chunk });
    }
    await testDb().$executeRaw`ANALYZE products, inventory_items`;
    products = await testDb().product.count({ where: { active: true } });
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await resetDatabase(testDb());
    await disconnectTestDb();
  });

  it(
    "answers 95 % of the searches in under 2 s",
    async ({ annotate }) => {
      const caller = await anonymousCaller(testDb());
      const searches = await withSecondPage(caller);
      for (const search of searches) await timeSearch(caller, search.input); // warm-up
      const samples = new Map(searches.map((search) => [search.label, [] as number[]]));
      const resultCounts = new Map<string, number>();
      for (let round = 0; round < config.CATALOG_PERF_ROUNDS; round += 1) {
        for (const search of searches) {
          const { elapsedMs, results } = await timeSearch(caller, search.input);
          samples.get(search.label)?.push(elapsedMs);
          resultCounts.set(search.label, results);
        }
      }

      const [version] = await testDb().$queryRaw<{ version: string }[]>`SELECT version()`;
      const report: PerfReport = {
        generatedAt: new Date().toISOString(),
        postgres: version?.version ?? "unknown",
        products,
        replicas: config.CATALOG_PERF_REPLICAS,
        rounds: config.CATALOG_PERF_ROUNDS,
        targetP95Ms: P95_TARGET_MS,
        overall: summarizeLatencies([...samples.values()].flat()),
        searches: searches.map(({ label }) => ({
          label,
          resultsFirstPage: resultCounts.get(label) ?? 0,
          stats: summarizeLatencies(samples.get(label) ?? []),
        })),
        plan: await queryPlan(testDb()),
      };
      if (config.CATALOG_PERF_REPORT_FILE) {
        await writeFile(config.CATALOG_PERF_REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
      }
      const { p50, p95, p99, count } = report.overall;
      await annotate(
        `${products} productos, ${count} búsquedas: p50 ${p50} ms · p95 ${p95} ms · p99 ${p99} ms`,
      );

      expect(products).toBe(buildCatalogProducts().length * config.CATALOG_PERF_REPLICAS);
      expect(report.overall.p95).toBeLessThan(P95_TARGET_MS);
      for (const search of report.searches) expect(search.stats.p95).toBeLessThan(P95_TARGET_MS);
    },
    HOOK_TIMEOUT_MS,
  );
});
