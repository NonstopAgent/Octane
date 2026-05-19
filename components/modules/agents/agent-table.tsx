"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Search } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AgentStatusBadge } from "./agent-status-badge";
import type { Agent, AgentRunRecord, AgentStatus } from "@/lib/types";

const tableClass =
  "w-full text-left text-sm [&_th]:border-b [&_th]:border-zinc-800 [&_th]:px-3 [&_th]:py-2.5 [&_th]:font-medium [&_th]:text-zinc-400 [&_td]:border-b [&_td]:border-zinc-800/60 [&_td]:px-3 [&_td]:py-2.5 [&_tr:last-child_td]:border-0";

type Props = {
  agents: Agent[];
  agentRuns: AgentRunRecord[];
  getProjectName: (id?: string) => string;
  getTaskTitle: (id?: string) => string;
  onSelect: (agent: Agent) => void;
};

const STATUS_OPTIONS: { value: AgentStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "running", label: "Running" },
  { value: "idle", label: "Idle" },
  { value: "paused", label: "Paused" },
  { value: "error", label: "Error" },
  { value: "offline", label: "Offline" },
];

export function AgentTable({
  agents,
  agentRuns,
  getProjectName,
  getTaskTitle,
  onSelect,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = agents.filter((a) => {
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.purpose.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  function getAgentRuns(agentId: string) {
    return agentRuns.filter((r) => r.agentId === agentId);
  }

  function getLastRun(agentId: string): AgentRunRecord | undefined {
    return getAgentRuns(agentId)
      .filter((r) => r.completedAt)
      .sort((a, b) =>
        (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
      )[0];
  }

  function getTotalCost(agentId: string): number {
    return getAgentRuns(agentId).reduce(
      (sum, r) => sum + (r.totalCostCents ?? 0),
      0,
    );
  }

  function getSuccessRate(agentId: string): number | undefined {
    const runs = getAgentRuns(agentId);
    if (runs.length === 0) return undefined;
    const succeeded = runs.filter((r) => r.status === "completed").length;
    return succeeded / runs.length;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-zinc-500" />
          <Input
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 border-zinc-800 bg-zinc-900/60 pl-8 text-sm text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-zinc-700"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AgentStatus | "all")}
          className="h-9 w-[180px] border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-x-auto border border-zinc-800/80 bg-zinc-900/30">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">
              No agents match the current filter.
            </p>
          ) : (
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Project</th>
                  <th>Task</th>
                  <th>Last run</th>
                  <th className="text-right">Runs</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Success</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent) => {
                  const runs = getAgentRuns(agent.id);
                  const lastRun = getLastRun(agent.id);
                  const totalCost = getTotalCost(agent.id);
                  const successRate = getSuccessRate(agent.id) ?? agent.successRate;
                  return (
                    <tr
                      key={agent.id}
                      className="cursor-pointer hover:bg-zinc-800/30 transition-colors"
                      onClick={() => onSelect(agent)}
                    >
                      <td>
                        <div>
                          <p className="font-medium text-zinc-200">{agent.name}</p>
                          <p className="text-xs text-zinc-500 mt-0.5 max-w-[200px] truncate">
                            {agent.purpose}
                          </p>
                        </div>
                      </td>
                      <td>
                        <AgentStatusBadge status={agent.status} />
                      </td>
                      <td className="text-zinc-400">
                        {getProjectName(agent.assignedProjectId)}
                      </td>
                      <td className="text-zinc-400 max-w-[160px] truncate">
                        {getTaskTitle(agent.currentTask)}
                      </td>
                      <td className="text-zinc-400">
                        {lastRun?.completedAt
                          ? format(new Date(lastRun.completedAt), "MMM d, HH:mm")
                          : agent.lastRunAt
                            ? format(new Date(agent.lastRunAt), "MMM d, yyyy")
                            : "—"}
                      </td>
                      <td className="text-right text-zinc-400">{runs.length}</td>
                      <td className="text-right text-zinc-400">
                        {totalCost > 0
                          ? `$${(totalCost / 100).toFixed(2)}`
                          : agent.costEstimate != null
                            ? `~$${agent.costEstimate.toFixed(2)}`
                            : "—"}
                      </td>
                      <td className="text-right">
                        {successRate != null ? (
                          <span
                            className={
                              successRate >= 0.8
                                ? "text-emerald-400"
                                : successRate >= 0.6
                                  ? "text-amber-400"
                                  : "text-red-400"
                            }
                          >
                            {Math.round(successRate * 100)}%
                          </span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
