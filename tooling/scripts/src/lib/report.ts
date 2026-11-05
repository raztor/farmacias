import { styleText } from "node:util";

export type Finding = { workspace: string; message: string };

/** Prints the result of a check and returns the exit code (0 = ok). */
export function report(title: string, findings: Finding[], details: string[] = []): number {
  const out = process.stdout;
  out.write(`${styleText("bold", title)}\n`);
  for (const line of details) out.write(`  ${styleText("dim", line)}\n`);
  if (findings.length === 0) {
    out.write(`${styleText("green", "✔ Sin problemas.")}\n`);
    return 0;
  }
  for (const finding of findings) {
    out.write(
      `${styleText("red", "✖")} ${styleText("bold", finding.workspace)}: ${finding.message}\n`,
    );
  }
  out.write(`\n${styleText("red", `${findings.length} problema(s).`)}\n`);
  return 1;
}
