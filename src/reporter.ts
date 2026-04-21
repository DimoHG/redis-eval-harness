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

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function sum(nums: number[]): number {
  return nums.reduce((s, n) => s + n, 0);
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
      baselineAvgInputTokens: avg(baseline.map((r) => r.inputTokens)),
      baselineAvgOutputTokens: avg(baseline.map((r) => r.outputTokens)),
      enhancedAvgInputTokens: avg(enhanced.map((r) => r.inputTokens)),
      enhancedAvgOutputTokens: avg(enhanced.map((r) => r.outputTokens)),
    });
  }

  return reports;
}

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function intStr(n: number): string {
  return Math.round(n).toString();
}

function signedInt(n: number): string {
  const rounded = Math.round(n);
  return rounded > 0 ? `+${rounded}` : rounded.toString();
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

  printTokenReport(results, reports, nameCol);
}

function printTokenReport(
  results: RunResult[],
  reports: CaseReport[],
  nameCol: number
): void {
  const tokCol = 8;
  const deltaCol = 8;
  const sep = "-".repeat(nameCol + tokCol * 4 + deltaCol + 13);

  console.log("Token usage (avg per run):");
  console.log(
    `${pad("Case", nameCol)} | ${pad("Base In", tokCol)} | ${pad("Base Out", tokCol)} | ${pad("Enh In", tokCol)} | ${pad("Enh Out", tokCol)} | ${pad("Out Δ", deltaCol)}`
  );
  console.log(sep);

  for (const r of reports) {
    const outDelta = r.enhancedAvgOutputTokens - r.baselineAvgOutputTokens;
    console.log(
      `${pad(r.caseName, nameCol)} | ${padLeft(intStr(r.baselineAvgInputTokens), tokCol)} | ${padLeft(intStr(r.baselineAvgOutputTokens), tokCol)} | ${padLeft(intStr(r.enhancedAvgInputTokens), tokCol)} | ${padLeft(intStr(r.enhancedAvgOutputTokens), tokCol)} | ${padLeft(signedInt(outDelta), deltaCol)}`
    );
  }

  console.log(sep);

  const baseline = results.filter((r) => r.mode === "baseline");
  const enhanced = results.filter((r) => r.mode === "enhanced");
  const baseInTotal = sum(baseline.map((r) => r.inputTokens));
  const baseOutTotal = sum(baseline.map((r) => r.outputTokens));
  const enhInTotal = sum(enhanced.map((r) => r.inputTokens));
  const enhOutTotal = sum(enhanced.map((r) => r.outputTokens));
  const totalOutDelta = enhOutTotal - baseOutTotal;

  console.log(
    `${pad("TOTAL (summed)", nameCol)} | ${padLeft(intStr(baseInTotal), tokCol)} | ${padLeft(intStr(baseOutTotal), tokCol)} | ${padLeft(intStr(enhInTotal), tokCol)} | ${padLeft(intStr(enhOutTotal), tokCol)} | ${padLeft(signedInt(totalOutDelta), deltaCol)}`
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

  const baseline = results.filter((r) => r.mode === "baseline");
  const enhanced = results.filter((r) => r.mode === "enhanced");

  const output = {
    rule: ruleName,
    model: CONFIG.model,
    runsPerCase: CONFIG.runsPerCase,
    temperature: CONFIG.temperature,
    timestamp: new Date().toISOString(),
    summary: buildCaseReports(results),
    totals: {
      baseline: {
        inputTokens: sum(baseline.map((r) => r.inputTokens)),
        outputTokens: sum(baseline.map((r) => r.outputTokens)),
      },
      enhanced: {
        inputTokens: sum(enhanced.map((r) => r.inputTokens)),
        outputTokens: sum(enhanced.map((r) => r.outputTokens)),
      },
    },
    results: results.map(({ response, ...rest }) => ({
      ...rest,
      responseLength: response.length,
      responsePreview: response.slice(0, 200),
    })),
  };

  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));
  return filePath;
}
