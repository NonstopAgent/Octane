const SENSITIVE_TOPIC_PATTERNS: RegExp[] = [
  /\btax\b/i,
  /\btaxes\b/i,
  /\birs\b/i,
  /\binvest(?:ment|ing|or)?\b/i,
  /\bsecurities\b/i,
  /\bstock option\b/i,
  /\b401\s*k\b/i,
  /\bcapital gains\b/i,
  /\bprofessional advice\b/i,
  /\blegal advice\b/i,
  /\battorney\b/i,
  /\blawyer\b/i,
  /\bcpa\b/i,
  /\baccountant\b/i,
  /\bvaluation\b/i,
  /\bfundraising\b/i,
  /\bterm sheet\b/i,
  /\bequity round\b/i,
];

export const EXECUTIVE_SENSITIVE_TOPIC_WARNING =
  "This response is for planning and organizational purposes only. It is not legal, tax, investment, or professional advice. Consult qualified professionals before acting on holdings, finance, or compliance matters.";

export function detectSensitiveExecutiveTopic(question: string): boolean {
  const normalized = question.trim();
  if (!normalized) return false;
  return SENSITIVE_TOPIC_PATTERNS.some((pattern) => pattern.test(normalized));
}
