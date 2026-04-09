import { loadEvalSuite, loadRule } from "./loader.js";
import { runEval } from "./runner.js";
import { printReport, saveReport } from "./reporter.js";

async function main() {
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
