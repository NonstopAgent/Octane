import type { OctaneStore } from "@/lib/store/octane-store";
import type { OctaneAction } from "@/lib/types/octane-action";
import type { CodingJobPlan } from "@/lib/types/coding-job";
import type { EntityType } from "@/lib/types/entity";
import type { ProjectConnectionKind } from "@/lib/types/project-connection";

/** Run an approved action — only safe, non-destructive mutations. */
export function executeApprovedOctaneAction(
  store: OctaneStore,
  action: OctaneAction,
): { ok: true } | { ok: false; error: string } {
  const payload = action.payload;

  try {
    switch (action.type) {
      case "add_project": {
        const name = String(payload.name ?? "New project");
        store.createProject({
          name,
          description: String(payload.description ?? ""),
          status: "building",
          priority: "medium",
          owner: store.profile.name || "Founder",
          progress: 0,
          revenueStatus: "pre_revenue",
        });
        return { ok: true };
      }
      case "create_task": {
        const title = String(payload.title ?? "New task");
        const projectId =
          String(payload.projectId ?? action.projectId ?? "") ||
          store.projects[0]?.id;
        if (!projectId) {
          return { ok: false, error: "No project available for task." };
        }
        store.createTask({
          title,
          description: String(payload.description ?? ""),
          projectId,
          assignedTo: "Logan",
          priority: "medium",
          status: "backlog",
          tags: ["octane-action"],
        });
        return { ok: true };
      }
      case "create_coding_job": {
        const repo = String(payload.repo ?? "");
        if (!repo) {
          return { ok: false, error: "GitHub repo (owner/name) required for coding job." };
        }
        store.createCodingJob({
          title: String(payload.title ?? action.title),
          prompt: String(payload.prompt ?? action.description),
          repo,
          mode: "review",
          status: "pending_approval",
          projectId: action.projectId ?? (payload.projectId ? String(payload.projectId) : undefined),
          plan: payload.plan as CodingJobPlan | undefined,
        });
        return { ok: true };
      }
      case "create_decision": {
        store.createDecision({
          title: String(payload.title ?? "Decision"),
          summary: String(payload.summary ?? action.description),
          category: "strategy",
          projectId: action.projectId,
          reasoning: action.description,
          optionsConsidered: [],
          finalDecision: "Pending review",
          expectedOutcome: "",
          status: "under_review",
        });
        return { ok: true };
      }
      case "add_entity": {
        store.createEntity({
          name: String(payload.name ?? "New entity"),
          type: (payload.type as EntityType) ?? "llc",
          status: "active",
          linkedProjectIds: [],
        });
        return { ok: true };
      }
      case "connect_github": {
        const github = store.connections.find((c) => c.provider === "github");
        if (github) {
          store.updateConnection(github.id, {
            status: "needs_attention",
            metadata: {
              ...(github.metadata ?? {}),
              repo: String(payload.repo ?? ""),
              note: "Approve recorded — complete OAuth when available",
            },
          });
        }
        return { ok: true };
      }
      case "connect_vercel": {
        const vercel = store.connections.find((c) => c.provider === "vercel");
        if (vercel) {
          store.updateConnection(vercel.id, {
            status: "needs_attention",
            metadata: {
              ...(vercel.metadata ?? {}),
              note: "Approve recorded — complete OAuth when available",
            },
          });
        }
        return { ok: true };
      }
      case "add_note": {
        store.createFounderNote({
          title: String(payload.title ?? "Note from Octane"),
          body: String(payload.body ?? action.description),
          linkedProjectId: action.projectId,
          tags: ["octane-action"],
        });
        return { ok: true };
      }
      case "add_reminder": {
        const due = new Date();
        due.setDate(due.getDate() + 7);
        store.createComplianceReminder({
          title: String(payload.title ?? "Reminder"),
          category: "other",
          status: "pending",
          dueDate: due.toISOString().slice(0, 10),
          projectId: action.projectId,
          notes: action.description,
        });
        return { ok: true };
      }
      case "link_project_resource": {
        const projectId = String(payload.projectId ?? action.projectId ?? "");
        if (!projectId) {
          return { ok: false, error: "No project specified for link." };
        }
        const kind = (payload.kind as ProjectConnectionKind) ?? "github";
        store.createProjectConnection({
          projectId,
          kind,
          label: String(payload.label ?? `${kind} link`),
          url: payload.url ? String(payload.url) : undefined,
          repo: payload.repo ? String(payload.repo) : undefined,
          status: "pending",
        });
        return { ok: true };
      }
      default:
        return { ok: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Execution failed";
    return { ok: false, error: msg };
  }
}
