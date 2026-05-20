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

/** Deterministic fallback when Anthropic is unavailable. */
export function buildDeterministicPlan(input: GeneratePlanInput): CodingJobPlan {
  const repoLabel = input.repo || "repository";
  const summary = `Review-mode plan for: ${input.prompt.slice(0, 160)}`;
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
      title: "Implement changes on branch",
      description: "Apply focused edits; avoid destructive GitHub operations.",
      status: "pending",
    },
    {
      id: stepId(3),
      order: 4,
      title: "Open pull request",
      description: "Create a PR for human review — never auto-merge.",
      status: "pending",
    },
  ];

  return {
    summary,
    steps,
    files: [`docs/octane-coding-jobs/<job-id>.md`],
    risks: [
      "Autopilot mode is disabled — all merges require manual approval on GitHub.",
      "Without GITHUB_TOKEN, PR creation is skipped in dev.",
    ],
    testPlan: [
      "Run npm run build locally",
      "Smoke-test affected UI paths",
      "Verify PR description matches the plan",
    ],
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
      steps,
      files: Array.isArray(raw.files) ? raw.files.map(String) : [],
      risks: Array.isArray(raw.risks) ? raw.risks.map(String) : [],
      testPlan: Array.isArray(raw.testPlan) ? raw.testPlan.map(String) : [],
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
summary (string), steps (array of {title, description}), files (string[]), risks (string[]), testPlan (string[]).
Never suggest merge, delete repo, deploy, or settings changes. Mode is ${input.mode}. Repo: ${input.repo}.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
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
