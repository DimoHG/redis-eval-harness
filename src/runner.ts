import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "./config.js";
import { scoreResponse } from "./scorer.js";
import type { EvalSuite, RunResult } from "./types.js";

const client = new Anthropic();

async function callClaude(
  userPrompt: string,
  systemPrompt?: string
): Promise<string> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        temperature: CONFIG.temperature,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = response.content[0];
      if (block.type === "text") return block.text;
      return "";
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Error &&
        ("status" in err &&
          ((err as { status: number }).status === 429 ||
            (err as { status: number }).status >= 500));

      if (!isRetryable || attempt === maxRetries - 1) throw err;

      const delay = Math.pow(2, attempt) * 1000;
      process.stderr.write(
        `  Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})...\n`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

export async function runEval(
  suite: EvalSuite,
  ruleContent: string
): Promise<RunResult[]> {
  const results: RunResult[] = [];
  const totalCalls = suite.cases.length * CONFIG.runsPerCase * 2;
  let completed = 0;

  for (const evalCase of suite.cases) {
    for (let run = 0; run < CONFIG.runsPerCase; run++) {
      // Baseline
      process.stderr.write(
        `  [${++completed}/${totalCalls}] ${evalCase.name} baseline run ${run + 1}...\n`
      );
      const baselineResponse = await callClaude(evalCase.prompt);
      const baselineScore = scoreResponse(baselineResponse, evalCase);
      results.push({
        caseName: evalCase.name,
        mode: "baseline",
        runIndex: run,
        response: baselineResponse,
        ...baselineScore,
      });

      // Enhanced
      process.stderr.write(
        `  [${++completed}/${totalCalls}] ${evalCase.name} enhanced run ${run + 1}...\n`
      );
      const enhancedResponse = await callClaude(evalCase.prompt, ruleContent);
      const enhancedScore = scoreResponse(enhancedResponse, evalCase);
      results.push({
        caseName: evalCase.name,
        mode: "enhanced",
        runIndex: run,
        response: enhancedResponse,
        ...enhancedScore,
      });
    }
  }

  return results;
}
