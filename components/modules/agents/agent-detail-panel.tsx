"use client";

import { useState } from "react";
import { format, formatDistanceStrict } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Info,
  Play,
  Trash2,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/modules/confirm-dialog";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { AgentStatusBadge } from "./agent-status-badge";
import type { Agent, AgentLog, AgentRunRecord, AgentStatus, Project, Task } from "@/lib/types";

type Props = {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentLogs: AgentLog[];
  agentRuns: AgentRunRecord[];
  projects: Project[];
  tasks: Task[];
  onUpdateStatus: (agentId: string, status: AgentStatus) => void;
  onAssignProject: (agentId: string, projectId: string) => void;
  onAssignTask: (agentId: string, taskId: string) => void;
  onSimulateRun: (agentId: string) => void;
  onClearLogs: (agentId: string) => void;
};

const STATUS_OPTIONS: AgentStatus[] = ["idle", "running", "paused", "error", "offline"];

function logTypeIcon(type: AgentLog["type"]) {
  switch (type) {
    case "success":
      return <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />;
    case "error":
      return <XCircle className="size-3.5 text-red-400 shrink-0" />;
    case "approval_request":
    case "approval_granted":
    case "approval_denied":
      return <CircleDot className="size-3.5 text-amber-400 shrink-0" />;
    case "cost":
      return <ChevronRight className="size-3.5 text-amber-300 shrink-0" />;
    case "run":
      return <Play className="size-3.5 text-zinc-400 shrink-0" />;
    default:
      return <Info className="size-3.5 text-zinc-500 shrink-0" />;
  }
}

function logTypeClass(type: AgentLog["type"]): string {
  switch (type) {
    case "success":
      return "text-emerald-300";
    case "error":
      return "text-red-300";
    case "approval_request":
    case "approval_granted":
    case "approval_denied":
      return "text-amber-300";
    case "cost":
      return "text-amber-200";
    default:
      return "text-zinc-400";
  }
}

function runStatusIcon(status: AgentRunRecord["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />;
    case "failed":
      return <XCircle className="size-3.5 text-red-400 shrink-0 mt-0.5" />;
    case "running":
      return <CircleDot className="size-3.5 text-amber-400 shrink-0 mt-0.5" />;
    default:
      return <AlertCircle className="size-3.5 text-zinc-500 shrink-0 mt-0.5" />;
  }
}

export function AgentDetailPanel({
  agent,
  open,
  onOpenChange,
  agentLogs,
  agentRuns,
  projects,
  tasks,
  onUpdateStatus,
  onAssignProject,
  onAssignTask,
  onSimulateRun,
  onClearLogs,
}: Props) {
  const [clearLogsOpen, setClearLogsOpen] = useState(false);

  if (!agent) return null;

  const agentLogList = agentLogs
    .filter((l) => l.agentId === agent.id)
    .slice(0, 20);

  const agentRunList = agentRuns
    .filter((r) => r.agentId === agent.id)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const assignedProject = projects.find((p) => p.id === agent.assignedProjectId);
  const projectTasks = assignedProject
    ? tasks.filter((t) => t.projectId === assignedProject.id)
    : [];

  const currentTaskTitle =
    tasks.find((t) => t.id === agent.currentTask)?.title ?? agent.currentTask ?? "—";

  function handleSimulate() {
    onSimulateRun(agent!.id);
  }

  function handleClearLogs() {
    onClearLogs(agent!.id);
    setClearLogsOpen(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-lg"
        >
          <SheetHeader className="pr-6">
            <SheetTitle className="flex items-center gap-2 text-zinc-50">
              {agent.name}
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              {agent.purpose}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-6 px-0 pb-8 text-sm">
            {/* Status badge */}
            <AgentStatusBadge status={agent.status} />

            {/* Project + task */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Project
                </p>
                <p className="mt-1 text-zinc-200">
                  {assignedProject?.name ?? "Unassigned"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Current task
                </p>
                <p className="mt-1 text-zinc-200 truncate">{currentTaskTitle}</p>
              </div>
            </div>

            {/* Capabilities */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-2">
                Capabilities
              </p>
              <div className="flex flex-wrap gap-1.5">
                {agent.capabilities.map((cap) => (
                  <Badge
                    key={cap}
                    variant="outline"
                    className="border-zinc-700 text-zinc-400 text-xs"
                  >
                    {formatStatusLabel(cap)}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Safety limits */}
            {agent.safetyLimits ? (
              <p className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-200/90">
                <span className="font-medium">Safety limits: </span>
                {agent.safetyLimits}
              </p>
            ) : null}

            {/* ── Run History ── */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-2">
                Run history
              </p>
              {agentRunList.length === 0 ? (
                <p className="text-zinc-500 text-xs">No runs recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {agentRunList.map((run) => {
                    const duration =
                      run.completedAt
                        ? formatDistanceStrict(
                            new Date(run.startedAt),
                            new Date(run.completedAt),
                          )
                        : "In progress";
                    return (
                      <div
                        key={run.id}
                        className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3"
                      >
                        <div className="flex items-start gap-2">
                          {runStatusIcon(run.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "text-xs font-medium capitalize",
                                  run.status === "completed" && "text-emerald-400",
                                  run.status === "failed" && "text-red-400",
                                  run.status === "running" && "text-amber-400",
                                  run.status === "cancelled" && "text-zinc-400",
                                )}
                              >
                                {run.status}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {format(new Date(run.startedAt), "MMM d, HH:mm")}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">{duration}</p>
                            {run.outcome ? (
                              <p className="text-xs text-zinc-300 mt-1">{run.outcome}</p>
                            ) : null}
                            {run.totalCostCents != null && run.totalCostCents > 0 ? (
                              <p className="text-xs text-amber-300/80 mt-0.5">
                                Cost: ${(run.totalCostCents / 100).toFixed(2)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Live Logs ── */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-2">
                Live logs (last 20)
              </p>
              {agentLogList.length === 0 ? (
                <p className="text-zinc-500 text-xs">No log entries yet.</p>
              ) : (
                <div className="space-y-1">
                  {agentLogList.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-900/50"
                    >
                      {logTypeIcon(log.type)}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs", logTypeClass(log.type))}>
                          {log.message}
                        </p>
                        {log.details ? (
                          <p className="text-xs text-zinc-600 mt-0.5">{log.details}</p>
                        ) : null}
                        {log.cost != null && log.cost > 0 ? (
                          <span className="text-xs text-amber-400/70">
                            ${(log.cost / 100).toFixed(2)}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-zinc-600 shrink-0">
                        {format(new Date(log.timestamp), "HH:mm:ss")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Manual controls ── */}
            <div className="space-y-3 border-t border-zinc-800 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Manual controls
              </p>

              {/* Status override */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-24 shrink-0">Set status</span>
                <Select
                  value={agent.status}
                  onChange={(e) => onUpdateStatus(agent.id, e.target.value as AgentStatus)}
                  className="h-8 flex-1 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-200"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Assign to project */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-24 shrink-0">Project</span>
                <Select
                  value={agent.assignedProjectId ?? "__none__"}
                  onChange={(e) => {
                    if (e.target.value !== "__none__") onAssignProject(agent.id, e.target.value);
                  }}
                  className="h-8 flex-1 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-200"
                >
                  <option value="__none__">Unassigned</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Assign to task (filtered by project) */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-24 shrink-0">Task</span>
                <Select
                  value={agent.currentTask ?? "__none__"}
                  onChange={(e) => {
                    if (e.target.value !== "__none__") onAssignTask(agent.id, e.target.value);
                  }}
                  disabled={projectTasks.length === 0}
                  className="h-8 flex-1 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-200 disabled:opacity-40"
                >
                  <option value="__none__">
                    {projectTasks.length === 0 ? "Select a project first" : "None"}
                  </option>
                  {projectTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700"
                  onClick={handleSimulate}
                >
                  <Play className="size-3 mr-1.5" />
                  Simulate Run
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  onClick={() => setClearLogsOpen(true)}
                >
                  <Trash2 className="size-3 mr-1.5" />
                  Clear Logs
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={clearLogsOpen}
        onOpenChange={setClearLogsOpen}
        title="Clear logs and runs?"
        description={`This will permanently remove all logs and run history for ${agent.name}. This cannot be undone.`}
        confirmLabel="Clear"
        onConfirm={handleClearLogs}
      />
    </>
  );
}
