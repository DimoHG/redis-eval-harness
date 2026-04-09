import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { CONFIG } from "./config.js";
import type { EvalSuite } from "./types.js";

export function loadEvalSuite(ruleName: string): EvalSuite {
  const filePath = path.join(CONFIG.evalsDir, `${ruleName}.yaml`);
  const raw = fs.readFileSync(filePath, "utf-8");
  return parseYaml(raw) as EvalSuite;
}

export function loadRule(ruleName: string): string {
  const filePath = path.join(CONFIG.rulesDir, `${ruleName}.md`);
  const raw = fs.readFileSync(filePath, "utf-8");

  // Strip YAML frontmatter if present
  const frontmatterRe = /^---\n[\s\S]*?\n---\n?/;
  return raw.replace(frontmatterRe, "").trim();
}
