import type { OctaneAction, OctaneActionSource, OctaneActionType } from "@/lib/types/octane-action";
import type { ProjectConnection } from "@/lib/types/project-connection";

export type ParseOctaneCommandInput = {
  text: string;
  source?: OctaneActionSource;
  projectId?: string;
  projectConnections?: ProjectConnection[];
  projects?: { id: string; name: string }[];
};

export type ParseOctaneCommandResult = {
  actions: OctaneAction[];
  replies: string[];
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
 * Deterministic command parser — returns proposed actions and read-only replies (never auto-executes).
 */
export function parseOctaneCommand(input: ParseOctaneCommandInput): ParseOctaneCommandResult {
  const text = input.text.trim();
  if (!text) return { actions: [], replies: [] };

  const lower = text.toLowerCase();
  const source = input.source ?? "chat";
  const actions: OctaneAction[] = [];
  const replies: string[] = [];

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

  const githubRepoMatch = text.match(
    /(?:connect|link)\s+github\s+(?:repo\s+)?([\w.-]+\/[\w.-]+)/i,
  );
  if (
    githubRepoMatch ||
    /\bconnect\s+github\s+repo\b/.test(lower) ||
    (/\bconnect\s+github\b/.test(lower) && /\brepo\b/.test(lower))
  ) {
    const repo = githubRepoMatch?.[1];
    actions.push(
      propose(
        "link_project_resource",
        repo ? `Link GitHub repo ${repo}` : "Connect GitHub repo",
        "Validates repo via read-only API, then links after approval.",
        { kind: "github", repo, projectId: input.projectId },
        source,
        input.projectId,
      ),
    );
  } else if (/\bconnect\s+github\b/.test(lower) || /\blink\s+github\b/.test(lower)) {
    const repoMatch = text.match(/github\s+(?:repo\s+)?([\w.-]+\/[\w.-]+)/i);
    actions.push(
      propose(
        "connect_github",
        "Connect GitHub",
        "Set GITHUB_TOKEN on the server and link repos from Connections.",
        { repo: repoMatch?.[1] },
        source,
        input.projectId,
      ),
    );
  }

  const vercelProjectMatch = text.match(
    /(?:connect|link)\s+vercel\s+(?:project\s+)?["']?([\w.-]+)["']?/i,
  );
  if (vercelProjectMatch || /\bconnect\s+vercel\s+project\b/.test(lower)) {
    const name = vercelProjectMatch?.[1];
    actions.push(
      propose(
        "link_project_resource",
        name ? `Link Vercel project ${name}` : "Connect Vercel project",
        "Validates project via read-only API, then links after approval.",
        { kind: "vercel", label: name, projectId: input.projectId },
        source,
        input.projectId,
      ),
    );
  } else if (/\bconnect\s+vercel\b/.test(lower) || /\blink\s+vercel\b/.test(lower)) {
    actions.push(
      propose(
        "connect_vercel",
        "Connect Vercel",
        "Set VERCEL_TOKEN on the server and link projects from Connections.",
        { projectId: input.projectId },
        source,
        input.projectId,
      ),
    );
  }

  if (
    /\bcheck\s+(the\s+)?deployment\b/.test(lower) ||
    /\bdeployment\s+status\b/.test(lower) ||
    /\blatest\s+deploy\b/.test(lower)
  ) {
    replies.push(
      "Open a linked project in Projects → Connections for live Vercel deployment status (read-only). Configure VERCEL_TOKEN on the server.",
    );
    actions.push(
      propose(
        "link_project_resource",
        "Check deployment",
        "Link a Vercel project to see deployment status on the project detail panel.",
        { kind: "vercel", projectId: input.projectId },
        source,
        input.projectId,
      ),
    );
  }

  if (
    /\bwhat\s+repos?\s+(are\s+)?connected\b/.test(lower) ||
    /\bwhich\s+repos?\s+(are\s+)?linked\b/.test(lower)
  ) {
    const githubLinks = (input.projectConnections ?? []).filter(
      (pc) => pc.kind === "github" && pc.repo,
    );
    if (githubLinks.length === 0) {
      replies.push("No GitHub repos linked to projects yet. Use Connections to link one.");
    } else {
      replies.push(
        `Linked repos: ${githubLinks.map((pc) => pc.repo).join(", ")}.`,
      );
    }
  }

  if (
    /\bmissing\s+github\b/.test(lower) ||
    /\bprojects?\s+without\s+github\b/.test(lower) ||
    /\bno\s+github\s+link\b/.test(lower)
  ) {
    const projects = input.projects ?? [];
    const links = input.projectConnections ?? [];
    const missing = projects.filter(
      (p) => !links.some((pc) => pc.projectId === p.id && pc.kind === "github"),
    );
    if (missing.length === 0) {
      replies.push("All projects have a GitHub link.");
    } else {
      replies.push(
        `Projects missing GitHub: ${missing.map((p) => p.name).join(", ")}.`,
      );
      actions.push(
        propose(
          "link_project_resource",
          "Link GitHub to projects",
          `Proposes linking GitHub for: ${missing.map((p) => p.name).join(", ")}.`,
          { kind: "github", projectIds: missing.map((p) => p.id) },
          source,
        ),
      );
    }
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

  return { actions, replies };
}
