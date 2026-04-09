import type { EvalCase } from "./types.js";

function extractCodeBlocks(text: string): string {
  const codeBlockRe = /```[\w]*\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = codeBlockRe.exec(text)) !== null) {
    blocks.push(match[1]);
  }
  return blocks.length > 0 ? blocks.join("\n") : text;
}

export function scoreResponse(
  response: string,
  evalCase: EvalCase
): { pass: boolean; matchedBad: string[]; matchedGood: string[] } {
  const code = extractCodeBlocks(response);

  const matchedBad = evalCase.bad_patterns.filter((p) =>
    new RegExp(p, "i").test(code)
  );

  const matchedGood = evalCase.good_patterns.filter((p) =>
    new RegExp(p, "i").test(code)
  );

  const pass = matchedGood.length > 0 && matchedBad.length === 0;

  return { pass, matchedBad, matchedGood };
}
