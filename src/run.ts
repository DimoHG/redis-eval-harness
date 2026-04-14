import fs from "node:fs";
import path from "node:path";
import { loadEvalSuite, loadRule } from "./loader.js";
import { runEval } from "./runner.js";
import { printReport, saveReport } from "./reporter.js";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnv();
  const ruleName = process.argv[2] ?? "conn-blocking";

  process.stderr.write(`Loading eval suite: ${ruleName}\n`);
  const suite = loadEvalSuite(ruleName);
  const ruleContent = loadRule(ruleName);

  process.stderr.write(
    `Loaded ${suite.cases.length} cases, rule is ${ruleContent.length} chars\n`
  );
  process.stderr.write(`Starting eval runs...\n\n`);

  const results = await runEval(suite, ruleContent);

  printReport(results, ruleName);

  const savedPath = saveReport(results, ruleName);
  process.stderr.write(`Full results saved to ${savedPath}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
