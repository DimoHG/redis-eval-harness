# Redis Agent Eval Harness

A PoC tool for testing whether Redis agent skills (rules/best practices injected into LLM context) actually improve agent behavior compared to a baseline.

## How it works

1. Define eval cases as YAML — coding tasks related to a Redis best-practice rule
2. Run each case through Claude **with** and **without** the skill
3. Score the generated code using regex pattern matching
4. Compare pass rates to measure the skill's impact

## Quick start

```bash
npm install
export ANTHROPIC_API_KEY=your-key
npx tsx src/run.ts
```
