/** Default Octane portfolio repos when project name appears in text. */
const PROJECT_REPO_MAP: { pattern: RegExp; repo: string }[] = [
  { pattern: /\bajax\b/i, repo: "NonstopAgent/Octane-Ajax" },
  { pattern: /\bnexus\b/i, repo: "NonstopAgent/Octane-Nexus" },
  {
    pattern: /\b(octane\s+core|octane-core|core)\b/i,
    repo: "NonstopAgent/Octane",
  },
];

const REPO_IN_TEXT = /([\w.-]+\/[\w.-]+)/;

export function inferGithubRepoFromText(text: string): string | undefined {
  const explicit = text.match(REPO_IN_TEXT);
  if (explicit?.[1]) return explicit[1];

  for (const { pattern, repo } of PROJECT_REPO_MAP) {
    if (pattern.test(text)) return repo;
  }
  return undefined;
}
