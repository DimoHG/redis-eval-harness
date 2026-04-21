import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export const CONFIG = {
  model: "claude-haiku-4-5-20251001" as const,
  runsPerCase: 3,
  temperature: 0.7,
  maxTokens: 2048,
  concurrency: 5,
  evalsDir: path.join(ROOT, "evals"),
  rulesDir: path.join(ROOT, "rules"),
  resultsDir: path.join(ROOT, "results"),
} as const;
