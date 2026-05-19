"use client";

import { useMemo } from "react";
import { Activity, AlertCircle, Bot, DollarSign } from "lucide-react";
import { isThisWeek } from "date-fns";

import { MetricCard } from "@/components/modules/metric-card";
import type { Agent, AgentRunRecord } from "@/lib/types";

type Props = {
  agents: Agent[];
  agentRuns: AgentRunRecord[];
};

export function AgentCostSummary({ agents, agentRuns }: Props) {
  const metrics = useMemo(() => {
    const totalCostCents = agentRuns.reduce(
      (sum, r) => sum + (r.totalCostCents ?? 0),
      0,
    );
    const activeCount = agents.filter((a) => a.status === "running").length;
    const errorCount = agents.filter((a) => a.status === "error").length;
    const completedThisWeek = agentRuns.filter(
      (r) =>
        r.status === "completed" &&
        r.completedAt &&
        isThisWeek(new Date(r.completedAt), { weekStartsOn: 1 }),
    ).length;

    return { totalCostCents, activeCount, errorCount, completedThisWeek };
  }, [agents, agentRuns]);

  const totalCostDisplay =
    metrics.totalCostCents === 0
      ? "$0.00"
      : `$${(metrics.totalCostCents / 100).toFixed(2)}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        title="Estimated total cost"
        value={totalCostDisplay}
        subtitle="Sum of all run costs"
        icon={DollarSign}
      />
      <MetricCard
        title="Active agents"
        value={metrics.activeCount}
        subtitle="Currently running"
        icon={Activity}
      />
      <MetricCard
        title="Error agents"
        value={metrics.errorCount}
        subtitle="Require attention"
        icon={AlertCircle}
      />
      <MetricCard
        title="Completed this week"
        value={metrics.completedThisWeek}
        subtitle="Successful runs"
        icon={Bot}
      />
    </div>
  );
}
