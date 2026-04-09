import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "./config.js";
import type { CaseReport, RunResult } from "./types.js";

function groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    const group = map.get(k) ?? [];
    group.push(item);
    map.set(k, group);
  }
  return map;
}

function passRate(results: RunResult[]): number {
  if (results.length === 0) return 0;
  return results.filter((r) => r.pass).length / results.length;
}

function buildCaseReports(results: RunResult[]): CaseReport[] {
  const byCase = groupBy(results, (r) => r.caseName);
  const reports: CaseReport[] = [];

  for (const [caseName, caseResults] of byCase) {
    const baseline = caseResults.filter((r) => r.mode === "baseline");
    const enhanced = caseResults.filter((r) => r.mode === "enhanced");
    const baselineRate = passRate(baseline);
    const enhancedRate = passRate(enhanced);

    reports.push({
      caseName,
      baselinePassRate: baselineRate,
      enhancedPassRate: enhancedRate,
      improvement: enhancedRate - baselineRate,
    });
  }

  return reports;
}

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function printReport(results: RunResult[], ruleName: string): void {
  const reports = buildCaseReports(results);

  const totalBaseline = passRate(results.filter((r) => r.mode === "baseline"));
  const totalEnhanced = passRate(results.filter((r) => r.mode === "enhanced"));

  console.log();
  console.log(`=== Redis Agent Eval: ${ruleName} ===`);
  console.log(
    `Model: ${CONFIG.model} | Runs per case: ${CONFIG.runsPerCase} | Temperature: ${CONFIG.temperature}`
  );
  console.log();

  const nameCol = 22;
  const valCol = 10;
  const sep = "-".repeat(nameCol + valCol * 3 + 6);

  console.log(
    `${pad("Case", nameCol)} | ${pad("Baseline", valCol)} | ${pad("Enhanced", valCol)} | Improvement`
  );
  console.log(sep);

  for (const r of reports) {
    const imp = r.improvement >= 0 ? `+${pct(r.improvement)}` : pct(r.improvement);
    console.log(
      `${pad(r.caseName, nameCol)} | ${pad(pct(r.baselinePassRate), valCol)} | ${pad(pct(r.enhancedPassRate), valCol)} | ${imp}`
    );
  }

  console.log(sep);

  const avgImp = totalEnhanced - totalBaseline;
  const impStr = avgImp >= 0 ? `+${pct(avgImp)}` : pct(avgImp);
  console.log(
    `${pad("AVERAGE", nameCol)} | ${pad(pct(totalBaseline), valCol)} | ${pad(pct(totalEnhanced), valCol)} | ${impStr}`
  );
  console.log();
}

export function saveReport(
  results: RunResult[],
  ruleName: string
): string {
  fs.mkdirSync(CONFIG.resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${ruleName}-${timestamp}.json`;
  const filePath = path.join(CONFIG.resultsDir, filename);

  const output = {
    rule: ruleName,
    model: CONFIG.model,
    runsPerCase: CONFIG.runsPerCase,
    temperature: CONFIG.temperature,
    timestamp: new Date().toISOString(),
    summary: buildCaseReports(results),
    results: results.map(({ response, ...rest }) => ({
      ...rest,
      responseLength: response.length,
      responsePreview: response.slice(0, 200),
    })),
  };

  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
  return filePath;
}
