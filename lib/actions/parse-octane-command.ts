import type { OctaneAction, OctaneActionSource, OctaneActionType } from "@/lib/types/octane-action";

export type ParseOctaneCommandInput = {
  text: string;
  source?: OctaneActionSource;
  projectId?: string;
};

function actionId(): string {
  return `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function propose(
  type: OctaneActionType,
  title: string,
  description: string,
  payload: Record<string, unknown>,
  source: OctaneActionSource,
  projectId?: string,
): OctaneAction {
  return {
    id: actionId(),
    type,
    status: "proposed",
    title,
    description,
    payload,
    source,
    projectId,
    proposedAt: new Date().toISOString(),
  };
}

/**
 * Deterministic command parser — returns proposed actions only (never auto-executes).
 */
export function parseOctaneCommand(input: ParseOctaneCommandInput): OctaneAction[] {
  const text = input.text.trim();
  if (!text) return [];

  const lower = text.toLowerCase();
  const source = input.source ?? "chat";
  const actions: OctaneAction[] = [];

  const addProject =
    /\b(add|create|new)\s+(a\s+)?project\b/.test(lower) ||
    /\bproject\s+(called|named)\b/.test(lower);
  if (addProject) {
    const nameMatch =
      text.match(/project\s+(?:called|named)\s+["']?([^"'\n.]+)["']?/i) ??
      text.match(/add\s+(?:a\s+)?project\s+["']?([^"'\n.]+)["']?/i);
    const name = nameMatch?.[1]?.trim() ?? "New project";
    actions.push(
      propose(
        "add_project",
        `Add project: ${name}`,
        "Create a new portfolio project after you approve.",
        { name, description: "" },
        source,
      ),
    );
  }

  if (/\b(create|add)\s+(a\s+)?task\b/.test(lower) || /\btask\s*:/.test(lower)) {
    const titleMatch =
      text.match(/task\s*(?::|—|-)\s*["']?([^"'\n]+)["']?/i) ??
      text.match(/(?:create|add)\s+(?:a\s+)?task\s+["']?([^"'\n.]+)["']?/i);
    const title = titleMatch?.[1]?.trim() ?? "New task";
    actions.push(
      propose(
        "create_task",
        `Create task: ${title}`,
        "Adds a task to your workspace after approval.",
        { title, projectId: input.projectId },
        source,
        input.projectId,
      ),
    );
  }

  if (/\b(create|add|log)\s+(a\s+)?decision\b/.test(lower)) {
    const titleMatch = text.match(/decision\s*(?::|—|-)\s*["']?([^"'\n]+)["']?/i);
    const title = titleMatch?.[1]?.trim() ?? "New decision";
    actions.push(
      propose(
        "create_decision",
        `Log decision: ${title}`,
        "Records a decision entry after approval.",
        { title, summary: text.slice(0, 200) },
        source,
        input.projectId,
      ),
    );
  }

  if (/\b(add|create)\s+(an?\s+)?entity\b/.test(lower)) {
    const nameMatch = text.match(/entity\s+(?:called|named)\s+["']?([^"'\n.]+)["']?/i);
    const name = nameMatch?.[1]?.trim() ?? "New entity";
    actions.push(
      propose(
        "add_entity",
        `Add entity: ${name}`,
        "Creates a holdings entity after approval.",
        { name, type: "llc" },
        source,
      ),
    );
  }

  if (/\bconnect\s+github\b/.test(lower) || /\blink\s+github\b/.test(lower)) {
    const repoMatch = text.match(/github\s+(?:repo\s+)?([\w.-]+\/[\w.-]+)/i);
    actions.push(
      propose(
        "connect_github",
        "Connect GitHub",
        "Opens the GitHub OAuth placeholder flow after approval (no keys stored locally).",
        { repo: repoMatch?.[1] },
        source,
        input.projectId,
      ),
    );
  }

  if (/\bconnect\s+vercel\b/.test(lower) || /\blink\s+vercel\b/.test(lower)) {
    actions.push(
      propose(
        "connect_vercel",
        "Connect Vercel",
        "Links Vercel deployment context after approval (OAuth placeholder).",
        { projectId: input.projectId },
        source,
        input.projectId,
      ),
    );
  }

  if (/\b(add|save)\s+(a\s+)?note\b/.test(lower) || /\bnote\s*:/.test(lower)) {
    const bodyMatch =
      text.match(/note\s*(?::|—|-)\s*([\s\S]+)/i) ??
      text.match(/(?:add|save)\s+(?:a\s+)?note\s+["']?([^"'\n]+)["']?/i);
    const body = bodyMatch?.[1]?.trim() ?? text;
    actions.push(
      propose(
        "add_note",
        "Add founder note",
        "Saves a founder note linked to context after approval.",
        { title: "Note from Octane", body: body.slice(0, 500) },
        source,
        input.projectId,
      ),
    );
  }

  if (/\b(add|set)\s+(a\s+)?reminder\b/.test(lower) || /\bremind\s+me\b/.test(lower)) {
    actions.push(
      propose(
        "add_reminder",
        "Add compliance reminder",
        "Creates a compliance reminder after approval.",
        { title: text.slice(0, 120) },
        source,
        input.projectId,
      ),
    );
  }

  if (
    /\blink\s+(external\s+)?resource\b/.test(lower) ||
    /\bconnect\s+(repo|website)\b/.test(lower)
  ) {
    actions.push(
      propose(
        "link_project_resource",
        "Link external resource",
        "Proposes linking GitHub, Vercel, or website to this project.",
        { hint: text.slice(0, 200), projectId: input.projectId },
        source,
        input.projectId,
      ),
    );
  }

  return actions;
}
