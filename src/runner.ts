import Anthropic from "@anthropic-ai/sdk";
import { CONFIG } from "./config.js";
import { scoreResponse } from "./scorer.js";
import type { EvalCase, EvalSuite, RunResult } from "./types.js";

let client: Anthropic;

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

interface ClaudeResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callClaude(
  userPrompt: string,
  systemPrompt?: string
): Promise<ClaudeResult> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await getClient().messages.create({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        temperature: CONFIG.temperature,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = response.content[0];
      const text = block?.type === "text" ? block.text : "";
      return {
        text,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Error &&
        "status" in err &&
        ((err as { status: number }).status === 429 ||
          (err as { status: number }).status >= 500);

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

interface Task {
  evalCase: EvalCase;
  mode: "baseline" | "enhanced";
  runIndex: number;
  systemPrompt?: string;
}

async function runTask(task: Task): Promise<RunResult> {
  const { text, inputTokens, outputTokens } = await callClaude(
    task.evalCase.prompt,
    task.systemPrompt
  );
  const score = scoreResponse(text, task.evalCase);
  return {
    caseName: task.evalCase.name,
    mode: task.mode,
    runIndex: task.runIndex,
    response: text,
    inputTokens,
    outputTokens,
    ...score,
  };
}

async function runPool(
  tasks: Task[],
  concurrency: number
): Promise<RunResult[]> {
  const results: RunResult[] = new Array(tasks.length);
  let nextIdx = 0;
  let completed = 0;
  const total = tasks.length;

  async function worker() {
    while (nextIdx < tasks.length) {
      const idx = nextIdx++;
      const task = tasks[idx];
      process.stderr.write(
        `  [${++completed}/${total}] ${task.evalCase.name} ${task.mode} run ${task.runIndex + 1}...\n`
      );
      results[idx] = await runTask(task);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function runEval(
  suite: EvalSuite,
  ruleContent: string
): Promise<RunResult[]> {
  const tasks: Task[] = [];

  for (const evalCase of suite.cases) {
    for (let run = 0; run < CONFIG.runsPerCase; run++) {
      tasks.push({ evalCase, mode: "baseline", runIndex: run });
      tasks.push({ evalCase, mode: "enhanced", runIndex: run, systemPrompt: ruleContent });
    }
  }

  return runPool(tasks, CONFIG.concurrency);
}
