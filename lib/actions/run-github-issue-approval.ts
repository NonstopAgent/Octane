import type { OctaneStore } from "@/lib/store/octane-store";
import type { OctaneAction } from "@/lib/types/octane-action";

/** Server write after explicit approval — never call without approved action. */
export async function runGitHubIssueApproval(
  get: () => OctaneStore,
  action: OctaneAction,
): Promise<void> {
  const repo = String(action.payload.repo ?? "");
  const title = String(action.payload.title ?? action.title);
  const body = String(action.payload.body ?? action.description);

  if (!repo || !title) {
    get().failOctaneAction(
      action.id,
      "GitHub issue requires repo and title in the approved action.",
    );
    return;
  }

  try {
    const res = await fetch("/api/integrations/github/create-issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repo,
        title,
        body,
        labels: Array.isArray(action.payload.labels)
          ? (action.payload.labels as string[])
          : undefined,
        actionId: action.id,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      number?: number;
      url?: string;
    };
    if (!res.ok || !data.ok) {
      get().failOctaneAction(
        action.id,
        data.error ?? `GitHub issue failed (${res.status})`,
      );
      return;
    }
    get().completeOctaneAction(action.id);
    get().recordActivity({
      action: "created",
      entityType: "system",
      entityId: action.id,
      entityName: action.title,
      description: `GitHub issue #${data.number ?? "?"} created in ${repo}${data.url ? ` — ${data.url}` : ""}`,
    });
  } catch (err) {
    get().failOctaneAction(
      action.id,
      err instanceof Error ? err.message : "GitHub issue request failed",
    );
  }
}
