import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const CONFIG = {
  model: "claude-sonnet-4-20250514" as const,
  runsPerCase: 5,
  temperature: 0.7,
  maxTokens: 1024,
  evalsDir: path.join(ROOT, "evals"),
  rulesDir: path.join(ROOT, "rules"),
  resultsDir: path.join(ROOT, "results"),
} as const;
