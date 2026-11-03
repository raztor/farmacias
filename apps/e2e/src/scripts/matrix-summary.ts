/**
 * Prints the browser matrix of a Playwright JSON report as a Markdown table (one row per test,
 * one column per project): the CI job appends it to the run summary and
 * docs/validation/navegadores.md records it.
 *
 *   node src/scripts/matrix-summary.ts test-results/results.json
 */
import { readFileSync } from "node:fs";

type Outcome = "expected" | "unexpected" | "flaky" | "skipped";

type ReportTest = { projectName: string; status: Outcome };
type ReportSpec = { title: string; file: string; tests: ReportTest[] };
type ReportSuite = { title: string; specs?: ReportSpec[]; suites?: ReportSuite[] };
type Report = {
  config: { projects: { name: string }[] };
  suites: ReportSuite[];
  stats: { startTime: string; duration: number };
};

const SYMBOLS: Readonly<Record<Outcome, string>> = {
  expected: "✅",
  flaky: "⚠️ (reintento)",
  unexpected: "❌",
  skipped: "⏭️",
};

/** Test name → project → outcome (the report lists each project's run as its own spec). */
type Rows = Map<string, Map<string, Outcome>>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function readReport(path: string): Report {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (
    !isObject(parsed) ||
    !Array.isArray(parsed.suites) ||
    !isObject(parsed.stats) ||
    !isObject(parsed.config)
  ) {
    throw new Error(`${path} is not a Playwright JSON report`);
  }
  // Shape checked above; the nested fields are the documented Playwright JSON reporter format.
  return parsed as Report;
}

function collectRows(suites: readonly ReportSuite[], rows: Rows): void {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      const name = `${suite.title} › ${spec.title}`;
      const results = rows.get(name) ?? new Map<string, Outcome>();
      for (const test of spec.tests) results.set(test.projectName, test.status);
      rows.set(name, results);
    }
    collectRows(suite.suites ?? [], rows);
  }
}

function toMarkdown(report: Report): string {
  const rows: Rows = new Map();
  collectRows(report.suites, rows);
  // Every configured project, in config order: one that did not run shows «—».
  const projects = report.config.projects.map((project) => project.name);
  const lines = [...rows].map(([name, results]) => {
    const cells = projects.map((project) => {
      const outcome = results.get(project);
      return outcome === undefined ? "—" : SYMBOLS[outcome];
    });
    return `| ${name} | ${cells.join(" | ")} |`;
  });
  const outcomes = [...rows.values()].flatMap((results) => [...results.values()]);
  const failed = outcomes.filter((outcome) => outcome === "unexpected").length;
  const minutes = (report.stats.duration / 60_000).toFixed(1);
  return [
    "### Matriz de navegadores (Playwright)",
    "",
    `Ejecución: ${report.stats.startTime} · ${String(outcomes.length)} ejecuciones · ` +
      `duración ${minutes} min · fallas: ${String(failed)}`,
    "",
    `| Prueba | ${projects.join(" | ")} |`,
    `| --- | ${projects.map(() => ":---:").join(" | ")} |`,
    ...lines,
    "",
  ].join("\n");
}

const [path] = process.argv.slice(2);
if (path === undefined) {
  process.stderr.write("Usage: node src/scripts/matrix-summary.ts <results.json>\n");
  process.exitCode = 2;
} else {
  process.stdout.write(toMarkdown(readReport(path)));
}
