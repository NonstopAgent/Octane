"use client";

import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { ActivityLog } from "@/lib/types/activity-log";
import type { OctaneAction } from "@/lib/types/octane-action";
import type { Task } from "@/lib/types/task";
import { isPendingOctaneAction } from "@/lib/types/octane-action";

import type { AgentMonitorRow } from "./agent-monitor-table";

type Props = {
  row: AgentMonitorRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function matchesAgentActivity(log: ActivityLog, row: AgentMonitorRow): boolean {
  const blob = `${log.entityName} ${log.description}`.toLowerCase();
  const keywords = row.activityKeywords;
  if (keywords.some((k) => blob.includes(k.toLowerCase()))) return true;
  if (log.entityId === row.projectId) return true;
  if (blob.includes(row.repo.toLowerCase())) return true;
  return false;
}

function matchesAgentAction(action: OctaneAction, row: AgentMonitorRow): boolean {
  if (action.projectId === row.projectId) return true;
  if (row.actionSources.includes(action.source)) {
    const blob = `${action.title} ${action.description}`.toLowerCase();
    if (row.activityKeywords.some((k) => blob.includes(k.toLowerCase()))) {
      return true;
    }
  }
  return false;
}

export function AgentOperationalSheet({ row, open, onOpenChange }: Props) {
  const tasks = useOctaneStore((s) => s.tasks);
  const octaneActions = useOctaneStore((s) => s.octaneActions);
  const activityLogs = useOctaneStore((s) => s.activityLogs);

  if (!row) return null;

  const assignedTasks: Task[] = tasks
    .filter((t) => t.projectId === row.projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12);

  const pendingActions = octaneActions
    .filter((a) => isPendingOctaneAction(a) && matchesAgentAction(a, row))
    .slice(0, 8);

  const timeline = activityLogs
    .filter((log) => matchesAgentActivity(log, row))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 16);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-lg"
      >
        <SheetHeader className="pr-6">
          <SheetTitle className="text-zinc-50">{row.name}</SheetTitle>
          <SheetDescription className="text-zinc-400">
            Read-only operational view — tasks, pending approvals, and activity for{" "}
            {row.pipelineNote}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Tasks assigned
            </p>
            {assignedTasks.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No tasks on this project yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {assignedTasks.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2"
                  >
                    <p className="font-medium text-zinc-200">{task.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 capitalize">
                      {task.status.replace(/_/g, " ")} · {task.priority}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Pending actions
            </p>
            {pendingActions.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">
                No pending proposals for this operator.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {pendingActions.map((action) => (
                  <li
                    key={action.id}
                    className="rounded-lg border border-amber-900/40 bg-amber-950/10 px-3 py-2"
                  >
                    <p className="font-medium text-zinc-200">{action.title}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {action.source}
                      {action.riskLevel ? ` · ${action.riskLevel}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/actions"
              className="mt-2 inline-block text-xs text-amber-500 hover:underline"
            >
              Open Actions triage →
            </Link>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Activity timeline
            </p>
            {timeline.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">No matching activity yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {timeline.map((log) => (
                  <li
                    key={log.id}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2"
                  >
                    <p className="text-zinc-300">{log.description}</p>
                    <p className="mt-1 text-[11px] text-zinc-600">
                      {format(new Date(log.createdAt), "MMM d, HH:mm")} ·{" "}
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
            <Link
              href={`/projects?detail=${row.projectId}`}
              className="inline-flex h-8 items-center rounded-lg border border-zinc-700 px-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Portfolio project
            </Link>
            <Link
              href="/actions"
              className="inline-flex h-8 items-center rounded-lg border border-zinc-700 px-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Actions queue
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
