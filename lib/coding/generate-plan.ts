import Anthropic from "@anthropic-ai/sdk";

import type { CodingJobPlan, CodingJobPlanStep } from "@/lib/types/coding-job";

export type GeneratePlanInput = {
  prompt: string;
  repo: string;
  mode: string;
  projectName?: string;
};

function stepId(index: number): string {
  return `plan-step-${index + 1}`;
}

const WONT_AUTO_DEFAULT = [
  "Auto-merge on GitHub",
  "Deploy to Vercel or production",
  "Delete branches, repos, or settings changes",
  "Commit source code edits in v1 (planning doc PR only)",
];

/** Deterministic fallback when Anthropic is unavailable. */
export function buildDeterministicPlan(input: GeneratePlanInput): CodingJobPlan {
  const repoLabel = input.repo || "repository";
  const understood = input.prompt.slice(0, 280);
  const summary = `Review-mode plan for ${repoLabel}: ${input.prompt.slice(0, 120)}`;
  const steps: CodingJobPlanStep[] = [
    {
      id: stepId(0),
      order: 1,
      title: "Clarify scope",
      description: "Confirm requirements and acceptance criteria with the founder.",
      status: "pending",
    },
    {
      id: stepId(1),
      order: 2,
      title: "Inspect repository",
      description: `Read relevant files in ${repoLabel} (read-only until PR is approved).`,
      status: "pending",
    },
    {
      id: stepId(2),
      order: 3,
      title: "Draft implementation approach",
      description: "Outline changes; keep edits in follow-up PRs after plan review.",
      status: "pending",
    },
    {
      id: stepId(3),
      order: 4,
      title: "Open planning pull request",
      description: "Create a PR with the Octane job doc for human review — never auto-merge.",
      status: "pending",
    },
  ];

  return {
    summary,
    understoodRequest: understood,
    steps,
    files: [
      `docs/octane-coding-jobs/<job-id>.md`,
      "README.md (if scope touches onboarding)",
      "app/ or components/ (likely in follow-up PRs)",
    ],
    risks: [
      "Autopilot mode is disabled — all merges require manual approval on GitHub.",
      "Without GITHUB_TOKEN, PR creation is skipped in local dev.",
      "Scope may span multiple modules — split follow-up PRs if needed.",
    ],
    testPlan: [
      "Run npm run build locally",
      "Smoke-test affected UI paths (dashboard, outlook, connections)",
      "Verify PR title/body matches the plan doc",
      "Confirm no deploy hooks triggered",
    ],
    reviewItems: [
      "Plan doc matches the founder prompt",
      "No unexpected file changes beyond docs/octane-coding-jobs/",
      "Review mode: branch + PR only — approve Run in Octane after plan sign-off",
    ],
    wontAutoHappen: WONT_AUTO_DEFAULT,
  };
}

function parsePlanJson(text: string): CodingJobPlan | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]) as Partial<CodingJobPlan>;
    if (!raw.summary || !Array.isArray(raw.steps)) return null;
    const steps = raw.steps.map((s, i) => ({
      id: stepId(i),
      order: i + 1,
      title: String((s as CodingJobPlanStep).title ?? `Step ${i + 1}`),
      description: (s as CodingJobPlanStep).description,
      status: "pending" as const,
    }));
    return {
      summary: String(raw.summary),
      understoodRequest: raw.understoodRequest
        ? String(raw.understoodRequest)
        : undefined,
      steps,
      files: Array.isArray(raw.files) ? raw.files.map(String) : [],
      risks: Array.isArray(raw.risks) ? raw.risks.map(String) : [],
      testPlan: Array.isArray(raw.testPlan) ? raw.testPlan.map(String) : [],
      reviewItems: Array.isArray(raw.reviewItems)
        ? raw.reviewItems.map(String)
        : undefined,
      wontAutoHappen: Array.isArray(raw.wontAutoHappen)
        ? raw.wontAutoHappen.map(String)
        : WONT_AUTO_DEFAULT,
    };
  } catch {
    return null;
  }
}

/** AI-assisted plan when ANTHROPIC_API_KEY is set; otherwise deterministic fallback. */
export async function generateCodingJobPlan(
  input: GeneratePlanInput,
): Promise<{ plan: CodingJobPlan; source: "anthropic" | "deterministic" }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { plan: buildDeterministicPlan(input), source: "deterministic" };
  }

  const client = new Anthropic({ apiKey });
  const system = `You are Octane's coding workbench planner. Output ONLY valid JSON with keys:
summary, understoodRequest, steps (array of {title, description}), files (string[]), risks (string[]), testPlan (string[]), reviewItems (string[]), wontAutoHappen (string[]).
Never suggest merge, delete repo, deploy, or settings changes. Mode is ${input.mode}. Repo: ${input.repo}.
wontAutoHappen must list what Octane will NOT do automatically.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1400,
      system,
      messages: [
        {
          role: "user",
          content: `Project: ${input.projectName ?? "n/a"}\nPrompt:\n${input.prompt}`,
        },
      ],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");
    const parsed = parsePlanJson(text);
    if (parsed) {
      return { plan: parsed, source: "anthropic" };
    }
  } catch {
    // fall through to deterministic
  }

  return { plan: buildDeterministicPlan(input), source: "deterministic" };
}
