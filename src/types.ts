export interface EvalCase {
  name: string;
  prompt: string;
  bad_patterns: string[];
  good_patterns: string[];
}

export interface EvalSuite {
  rule: string;
  description: string;
  cases: EvalCase[];
}

export interface RunResult {
  caseName: string;
  mode: "baseline" | "enhanced";
  runIndex: number;
  response: string;
  pass: boolean;
  matchedBad: string[];
  matchedGood: string[];
}

export interface CaseReport {
  caseName: string;
  baselinePassRate: number;
  enhancedPassRate: number;
  improvement: number;
}
